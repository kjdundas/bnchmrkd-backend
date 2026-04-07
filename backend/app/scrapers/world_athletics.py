"""
World Athletics profile scraper — real Selenium implementation.

Scrapes an athlete's full competition history from their World Athletics profile,
extracts DOB/nationality from __NEXT_DATA__ JSON, iterates through all years via
the dropdown, and returns structured race data grouped by discipline.

Adapted from the athletics-scraper-pipeline Selenium notebooks.
"""

import json
import re
import time
from datetime import date, datetime
from typing import Optional, Callable

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    InvalidSessionIdException,
    WebDriverException,
    NoSuchWindowException,
    TimeoutException,
)
from webdriver_manager.chrome import ChromeDriverManager

from app.scrapers.base import BaseScraper
from app.models.schemas import ScrapedAthleteData, RaceInput


# Regex patterns to identify supported disciplines from World Athletics event names.
# WA uses variations like "100 Metres", "Men's 200 Metres", "Women's 100m Hurdles", etc.
DISCIPLINE_PATTERNS = [
    # Hurdles (check before sprints to avoid false matches)
    (re.compile(r"\b400\s*m(?:etres?)?\s+hurdles?\b", re.IGNORECASE), "400mH"),
    (re.compile(r"\b110\s*m(?:etres?)?\s+hurdles?\b", re.IGNORECASE), "110mH"),
    (re.compile(r"\b100\s*m(?:etres?)?\s+hurdles?\b", re.IGNORECASE), "100mH"),
    # Sprints
    (re.compile(r"\b400\s*m(?:etres?)?\b(?!.*hurdle)", re.IGNORECASE), "400m"),
    (re.compile(r"\b200\s*m(?:etres?)?\b", re.IGNORECASE), "200m"),
    (re.compile(r"\b100\s*m(?:etres?)?\b(?!.*hurdle)", re.IGNORECASE), "100m"),
    # Throws (match with or without weight suffix like "(5kg)", "(1,75kg)")
    (re.compile(r"\bDiscus\s+Throw\b", re.IGNORECASE), "Discus Throw"),
    (re.compile(r"\bJavelin\s+Throw\b", re.IGNORECASE), "Javelin Throw"),
    (re.compile(r"\bHammer\s+Throw\b", re.IGNORECASE), "Hammer Throw"),
    (re.compile(r"\bShot\s+Put\b", re.IGNORECASE), "Shot Put"),
]

# Throws disciplines — used to detect whether a mark is distance (metres) vs time (seconds)
THROWS_DISCIPLINE_CODES = {"Discus Throw", "Javelin Throw", "Hammer Throw", "Shot Put"}

# Pattern to extract implement weight from WA discipline names like "Hammer Throw (5kg)"
WEIGHT_SUFFIX_RE = re.compile(r"\((\d+(?:[.,]\d+)?)\s*(?:kg|gr)\)", re.IGNORECASE)

DATE_FORMAT = "%d %b %Y"


def _parse_date(date_str: str) -> Optional[date]:
    """Parse a date string like '07 FEB 2026' or '04 MAY 1999' to a date object."""
    try:
        return datetime.strptime(date_str.strip().upper(), DATE_FORMAT).date()
    except (ValueError, AttributeError):
        return None


def _parse_mark(mark_str: str, is_throws: bool = False) -> Optional[float]:
    """
    Parse a time or distance mark string into a numeric value.

    For sprints/hurdles: time in seconds (e.g., '10.85', '10.85h' for hand-timed)
    For throws: distance in metres (e.g., '73.44', '21.05')

    Returns None for DNS, DNF, DQ, NM, etc.
    """
    if not mark_str:
        return None
    # Clean the string
    clean = mark_str.strip().lower()
    # Remove hand-timing indicator (sprints only, but harmless for throws)
    clean = clean.replace('h', '')
    # Skip non-result marks
    if any(x in clean for x in ['dns', 'dnf', 'dq', 'nm', 'nh', '-', 'x']):
        return None
    # Handle throws foul mark ('x' already caught above, but 'X' standalone)
    if clean == 'x' or clean == '':
        return None
    try:
        val = float(clean)
        # Basic sanity: throws distances > 0, sprint times > 0
        return val if val > 0 else None
    except ValueError:
        return None


def _parse_implement_weight(raw_discipline: str) -> Optional[float]:
    """
    Extract implement weight in kg from a WA discipline name.

    Examples:
        "Hammer Throw (5kg)" -> 5.0
        "Shot Put (4kg)" -> 4.0
        "Javelin Throw (700g)" -> 0.7  (converted from grams via 'gr'/'g' suffix)
        "Discus Throw (1,75kg)" -> 1.75
        "Shot Put" -> None (senior weight, no suffix)
    """
    match = WEIGHT_SUFFIX_RE.search(raw_discipline)
    if not match:
        return None
    weight_str = match.group(1).replace(',', '.')
    weight = float(weight_str)
    # Check if original text said "gr" or "g" (grams) — convert to kg
    suffix = raw_discipline[match.start():match.end()].lower()
    if 'gr' in suffix or ('g' in suffix and 'kg' not in suffix):
        weight = weight / 1000.0
    return weight


def _parse_wind(wind_str: str) -> Optional[float]:
    """Parse wind reading like '+1.2', '-0.3', '1.5'. Returns None if unavailable."""
    if not wind_str or wind_str.strip() in ('', '-', 'N/A'):
        return None
    try:
        return float(wind_str.strip().replace('+', ''))
    except ValueError:
        return None


def _normalize_discipline(raw: str) -> Optional[str]:
    """
    Map a raw discipline name from World Athletics to our internal code.
    Uses regex to handle variations like "Men's 100 Metres", "200m", "Hammer Throw (5kg)", etc.
    Returns the base discipline code (e.g., "Hammer Throw", not "Hammer Throw (5kg)").
    """
    if not raw:
        return None
    for pattern, code in DISCIPLINE_PATTERNS:
        if pattern.search(raw):
            return code
    return None


class WorldAthleticsScraper(BaseScraper):
    """
    Full Selenium-based scraper for World Athletics athlete profiles.

    Navigates to the athlete's profile, extracts biographical info from
    __NEXT_DATA__ JSON, clicks through STATISTICS > RESULTS, iterates
    all years via dropdown, and returns structured race data.
    """

    def __init__(self):
        self._driver = None

    def can_handle(self, url: str) -> bool:
        return "worldathletics.org" in url and (
            "/athlete" in url or "/athletes" in url
        )

    def _create_driver(self):
        """Create a headless Chrome instance."""
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options,
        )
        driver.set_page_load_timeout(30)
        return driver

    def _is_session_alive(self) -> bool:
        try:
            _ = self._driver.current_url
            return True
        except (InvalidSessionIdException, NoSuchWindowException, WebDriverException):
            return False

    def _extract_athlete_info(self) -> dict:
        """Extract DOB, nationality, name, and gender from __NEXT_DATA__ JSON."""
        result = {"name": None, "dob": None, "nationality": None, "gender": None}
        try:
            next_data_raw = self._driver.execute_script(
                "return document.getElementById('__NEXT_DATA__').textContent;"
            )
            next_data = json.loads(next_data_raw)
            basic_data = next_data["props"]["pageProps"]["competitor"]["basicData"]

            # World Athletics uses various keys for athlete name
            name = (
                basic_data.get("displayName")
                or basic_data.get("name")
                or basic_data.get("givenName", "") + " " + basic_data.get("familyName", "")
            )
            result["name"] = name.strip() if name else None
            print(f"  [scraper] Athlete name: {result['name']}")
            print(f"  [scraper] Available basicData keys: {list(basic_data.keys())}")
            dob_str = basic_data.get("birthDate", "")
            result["dob"] = _parse_date(dob_str) if dob_str else None
            result["nationality"] = basic_data.get("countryFullName", "").strip() or None

            # Gender: check multiple possible keys World Athletics uses.
            # IMPORTANT: check "women" BEFORE "men" because "men" is a substring of "women".
            gender_val = None
            for key in ("sexCode", "sex", "gender"):
                raw = (basic_data.get(key) or "").strip().upper()
                if raw in ("M", "MALE", "MEN"):
                    gender_val = "M"
                    break
                if raw in ("F", "W", "FEMALE", "WOMEN"):
                    gender_val = "F"
                    break

            if gender_val is None:
                slug = (basic_data.get("sexNameUrlSlug") or "").lower()
                if "women" in slug:          # check women first!
                    gender_val = "F"
                elif "men" in slug:
                    gender_val = "M"

            if gender_val is None:
                print(f"  [scraper] ⚠ Could not determine gender from basicData: {basic_data}")

            result["gender"] = gender_val

        except Exception as e:
            print(f"  [scraper] Failed to extract athlete info: {e}")
        return result

    def _close_cookie_banner(self, wait: WebDriverWait):
        """Dismiss the cookie consent banner if present."""
        try:
            cookie_btn = WebDriverWait(self._driver, 5).until(
                EC.element_to_be_clickable(
                    (By.ID, "CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll")
                )
            )
            cookie_btn.click()
        except:
            pass

    def _click_statistics_tab(self, wait: WebDriverWait) -> bool:
        """Navigate to the STATISTICS tab."""
        try:
            stats_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//*[text()='STATISTICS']"))
            )
            stats_button.click()
            time.sleep(2)
            return True
        except Exception as e:
            print(f"  [scraper] Could not click STATISTICS: {e}")
            return False

    def _click_results_tab(self, wait: WebDriverWait) -> bool:
        """Navigate to the RESULTS sub-tab."""
        try:
            all_elements = self._driver.find_elements(By.XPATH, "//*[text()='Results']")
            for el in all_elements:
                try:
                    self._driver.execute_script("arguments[0].scrollIntoView(true);", el)
                    time.sleep(0.5)
                    if el.is_displayed() and el.is_enabled():
                        el.click()
                        time.sleep(2)
                        return True
                except:
                    continue
            return False
        except Exception as e:
            print(f"  [scraper] Error locating RESULTS tab: {e}")
            return False

    def _scrape_results_table(self) -> list[dict]:
        """Scrape the current results table and return list of row dicts."""
        rows_data = []
        try:
            table = WebDriverWait(self._driver, 10).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "table.profileStatistics_table__1o71p")
                )
            )
            rows = table.find_elements(By.TAG_NAME, "tr")
            if not rows:
                return []

            # Extract header
            header_cells = rows[0].find_elements(By.TAG_NAME, "th")
            if not header_cells:
                header_cells = rows[0].find_elements(By.TAG_NAME, "td")
            headers = [cell.text.strip().lower() for cell in header_cells]

            # Extract data rows
            for row in rows[1:]:
                cells = row.find_elements(By.TAG_NAME, "td")
                if not cells:
                    continue
                cell_texts = [cell.text.strip() for cell in cells]
                if len(cell_texts) == len(headers):
                    rows_data.append(dict(zip(headers, cell_texts)))
                elif len(cell_texts) > 0:
                    # Sometimes columns don't match perfectly — try best effort
                    row_dict = {}
                    for i, text in enumerate(cell_texts):
                        if i < len(headers):
                            row_dict[headers[i]] = text
                    rows_data.append(row_dict)

        except TimeoutException:
            pass
        except Exception as e:
            print(f"  [scraper] Error scraping table: {e}")
        return rows_data

    def _get_all_years(self, wait: WebDriverWait) -> tuple[str, list[str]]:
        """Get the current year and list of all available years from dropdown."""
        current_year = ""
        all_years = []
        try:
            current_year_element = wait.until(
                EC.presence_of_element_located(
                    (By.CLASS_NAME, "athletesSelectInput__single-value")
                )
            )
            current_year = current_year_element.text.strip()

            dropdown_arrow = wait.until(
                EC.element_to_be_clickable(
                    (By.CLASS_NAME, "athletesSelectInput__dropdown-indicator")
                )
            )
            dropdown_arrow.click()
            time.sleep(1)

            year_elements = self._driver.find_elements(
                By.CLASS_NAME, "athletesSelectInput__option"
            )
            all_years = [y.text.strip() for y in year_elements]

            dropdown_arrow.click()
            time.sleep(0.5)
        except Exception as e:
            print(f"  [scraper] Error reading year dropdown: {e}")

        return current_year, all_years

    def _select_year(self, year: str, wait: WebDriverWait) -> bool:
        """Select a specific year from the dropdown."""
        try:
            dropdown_arrow = wait.until(
                EC.element_to_be_clickable(
                    (By.CLASS_NAME, "athletesSelectInput__dropdown-indicator")
                )
            )
            dropdown_arrow.click()
            WebDriverWait(self._driver, 5).until(
                EC.presence_of_element_located(
                    (By.CLASS_NAME, "athletesSelectInput__menu")
                )
            )
            year_option = self._driver.find_element(
                By.XPATH,
                f"//div[contains(@class,'athletesSelectInput__option') and text()='{year}']",
            )
            self._driver.execute_script("arguments[0].click();", year_option)
            time.sleep(2)
            return True
        except Exception as e:
            print(f"  [scraper] Failed to select year {year}: {e}")
            return False

    async def scrape(
        self,
        url: str,
        progress_callback: Optional[Callable] = None,
    ) -> dict:
        """
        Scrape all competition results from a World Athletics athlete profile.

        Args:
            url: World Athletics profile URL
            progress_callback: Optional async callable for progress updates
                              Called with (step: str, message: str, progress: float)

        Returns:
            Dict with keys:
                athlete_name, gender, dob, nationality,
                disciplines: { "100m": [race_dicts], "200m": [...], ... }
        """
        if not self.can_handle(url):
            raise ValueError(f"Not a World Athletics URL: {url}")

        async def emit(step, message, progress=0.0):
            if progress_callback:
                await progress_callback(step, message, progress)

        await emit("initializing", "Starting browser...", 0.0)

        self._driver = self._create_driver()
        wait = WebDriverWait(self._driver, 10)

        try:
            # ── Load profile ──
            await emit("loading", "Loading athlete profile...", 0.05)
            self._driver.get(url)
            time.sleep(2)

            self._close_cookie_banner(wait)

            # ── Extract athlete info ──
            await emit("extracting", "Reading athlete information...", 0.10)
            info = self._extract_athlete_info()

            # ── Navigate to STATISTICS > RESULTS ──
            await emit("navigating", "Navigating to competition results...", 0.15)
            if not self._click_statistics_tab(wait):
                raise RuntimeError("Could not find STATISTICS tab on this profile")
            if not self._click_results_tab(wait):
                raise RuntimeError("Could not find RESULTS sub-tab on this profile")

            # ── Get all available years ──
            await emit("scanning", "Scanning available seasons...", 0.20)
            current_year, all_years = self._get_all_years(wait)

            if not all_years:
                all_years = [current_year] if current_year else []
            if not all_years:
                raise RuntimeError("No competition years found for this athlete")

            # ── Scrape default year ──
            all_rows = []
            total_years = len(all_years)
            await emit(
                "scraping",
                f"Scraping {current_year} results (1/{total_years})...",
                0.25,
            )
            rows = self._scrape_results_table()
            for row in rows:
                row["_year"] = current_year
            all_rows.extend(rows)

            # ── Scrape remaining years ──
            for idx, year in enumerate(all_years):
                if year == current_year:
                    continue
                progress = 0.25 + (0.60 * (idx + 1) / total_years)
                await emit(
                    "scraping",
                    f"Scraping {year} results ({idx + 2}/{total_years})...",
                    min(progress, 0.85),
                )
                if self._select_year(year, wait):
                    rows = self._scrape_results_table()
                    for row in rows:
                        row["_year"] = year
                    all_rows.extend(rows)

            # ── Parse and group by discipline ──
            await emit("parsing", "Parsing race results...", 0.88)
            disciplines = self._group_by_discipline(all_rows, info)

            # ── Done ──
            await emit("complete", "Scraping complete!", 1.0)

            return {
                "athlete_name": info["name"] or "Unknown",
                "gender": info["gender"],  # do NOT default — let caller handle None
                "dob": info["dob"].isoformat() if info["dob"] else None,
                "nationality": info["nationality"],
                "disciplines": disciplines,
                "total_races": sum(len(races) for races in disciplines.values()),
                "years_scraped": total_years,
            }

        finally:
            try:
                self._driver.quit()
            except:
                pass
            self._driver = None

    def _group_by_discipline(self, all_rows: list[dict], info: dict) -> dict:
        """
        Parse raw table rows and group into supported disciplines.

        Returns dict mapping discipline codes to lists of race dicts:
        { "100m": [{ "date": "2024-06-15", "time": 10.85, "wind": 1.2, ... }], ... }
        """
        disciplines = {}

        if all_rows:
            print(f"  [scraper] First row columns: {list(all_rows[0].keys())}")
            print(f"  [scraper] First row values: {all_rows[0]}")
            print(f"  [scraper] Total raw rows: {len(all_rows)}")

        # Find which column contains the discipline/event info
        # Check all possible column name variants (case-insensitive since we lowercased headers)
        discipline_col = None
        mark_col = None
        date_col = None
        wind_col = None
        comp_col = None
        venue_col = None

        if all_rows:
            cols = list(all_rows[0].keys())
            for col in cols:
                cl = col.lower()
                if cl in ("discipline", "event", "disc.", "disc", "event name") and not discipline_col:
                    discipline_col = col
                elif cl in ("mark", "result", "perf", "performance", "time", "result/mark") and not mark_col:
                    mark_col = col
                elif cl in ("date",) and not date_col:
                    date_col = col
                elif cl in ("wind",) and not wind_col:
                    wind_col = col
                elif cl in ("competition", "meeting", "comp", "comp.", "meet") and not comp_col:
                    comp_col = col
                elif cl in ("venue", "place", "location") and not venue_col:
                    venue_col = col

            print(f"  [scraper] Column mapping: discipline={discipline_col}, mark={mark_col}, date={date_col}, wind={wind_col}, comp={comp_col}")

            # If no discipline column found, try to find it by checking which column
            # contains text that looks like an event name
            if not discipline_col:
                for col in cols:
                    if col.startswith("_"):
                        continue
                    sample_values = [row.get(col, "") for row in all_rows[:10]]
                    for val in sample_values:
                        if _normalize_discipline(val):
                            discipline_col = col
                            print(f"  [scraper] Auto-detected discipline column: '{col}' (matched '{val}')")
                            break
                    if discipline_col:
                        break

        if not discipline_col:
            print(f"  [scraper] WARNING: No discipline/event column found!")
            # Last resort: if there's no discipline column, try to detect discipline
            # from the mark value (sprint times are <60s, etc.) — limited but better than nothing
            return disciplines

        matched = 0
        unmatched_events = set()

        for row in all_rows:
            raw_discipline = row.get(discipline_col, "")
            disc_code = _normalize_discipline(raw_discipline)

            if not disc_code:
                unmatched_events.add(raw_discipline)
                continue

            # Determine if this is a throws discipline for mark parsing
            is_throws = disc_code in THROWS_DISCIPLINE_CODES

            mark_value = row.get(mark_col, "") if mark_col else ""
            mark_val = _parse_mark(mark_value, is_throws=is_throws)
            if mark_val is None:
                continue

            date_value = row.get(date_col, "") if date_col else ""
            date_val = _parse_date(date_value)

            wind_value = row.get(wind_col, "") if wind_col else ""
            wind_val = _parse_wind(wind_value)

            competition = row.get(comp_col, "") if comp_col else ""
            venue = row.get(venue_col, "") if venue_col else ""

            race = {
                "date": date_val.isoformat() if date_val else None,
                "time": mark_val,  # time_seconds for sprints, distance_m for throws
                "wind": wind_val,
                "competition": competition,
                "venue": venue,
                "year": row.get("_year", ""),
            }

            # Extract implement weight for throws (e.g., "Hammer Throw (5kg)" -> 5.0)
            if is_throws:
                weight = _parse_implement_weight(raw_discipline)
                race["implement_weight_kg"] = weight  # None = senior weight

            if disc_code not in disciplines:
                disciplines[disc_code] = []
            disciplines[disc_code].append(race)
            matched += 1

        print(f"  [scraper] Matched {matched} races across {len(disciplines)} disciplines: {list(disciplines.keys())}")
        if unmatched_events:
            print(f"  [scraper] Unmatched events (not supported): {unmatched_events}")

        return disciplines
