"""
Scraping API routes with Server-Sent Events (SSE) for real-time progress.

The /scrape endpoint accepts a World Athletics URL and streams progress events
to the frontend while Selenium scrapes the athlete's full competition history.
When complete, sends the final data grouped by discipline.
"""

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.scrapers.world_athletics import WorldAthleticsScraper

router = APIRouter(prefix="/api/v1", tags=["scraping"])


class ScrapeRequest(BaseModel):
    """Request body for the scrape endpoint."""
    url: str = Field(..., min_length=10, description="World Athletics profile URL")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if "worldathletics.org" not in v:
            raise ValueError("URL must be from worldathletics.org")
        return v


@router.post(
    "/scrape",
    summary="Scrape athlete profile with live progress",
    description="Streams SSE progress events while scraping, then sends final data",
)
async def scrape_athlete(request: ScrapeRequest):
    """
    Scrape a World Athletics athlete profile and stream progress via SSE.

    Events sent:
        - progress: { step, message, progress (0-1) }
        - complete: { data: full scraped result }
        - error: { message }
    """
    scraper = WorldAthleticsScraper()

    if not scraper.can_handle(request.url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must be a World Athletics athlete profile",
        )

    # Queue for progress events from the scraper
    progress_queue: asyncio.Queue = asyncio.Queue()

    async def progress_callback(step: str, message: str, progress: float):
        """Called by the scraper to report progress."""
        await progress_queue.put({
            "event": "progress",
            "data": {"step": step, "message": message, "progress": progress},
        })

    async def run_scraper():
        """Run the scraper in a thread to avoid blocking the event loop."""
        try:
            result = await scraper.scrape(
                url=request.url,
                progress_callback=progress_callback,
            )
            await progress_queue.put({
                "event": "complete",
                "data": result,
            })
        except Exception as e:
            await progress_queue.put({
                "event": "error",
                "data": {"message": str(e)},
            })

    async def event_stream() -> AsyncGenerator[str, None]:
        """Generate SSE events from the progress queue."""
        # Start the scraper as a background task
        task = asyncio.create_task(run_scraper())

        while True:
            try:
                event = await asyncio.wait_for(progress_queue.get(), timeout=120)
                event_type = event["event"]
                event_data = json.dumps(event["data"])
                yield f"event: {event_type}\ndata: {event_data}\n\n"

                if event_type in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                # Send keepalive
                yield f"event: keepalive\ndata: {{}}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
                break

        # Ensure task is done
        if not task.done():
            task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
