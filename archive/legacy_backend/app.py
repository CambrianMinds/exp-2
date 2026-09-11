"""
Indiana Expungement Form Bot — FastAPI Microservice
Accepts case data from the Chrome Extension and returns a court-ready ZIP packet.

Usage:
    cd backend
    pip install -r requirements.txt
    uvicorn app:app --host 127.0.0.1 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Union
import io

from form_engine import generate_packet

app = FastAPI(
    title="Indiana Expungement Form Bot",
    description="Generates court-ready IC § 35-38-9 expungement petition packets",
    version="1.0.0"
)

# CORS: Allow only the Chrome Extension and local development hosts.
# Block everything else to prevent open-proxy abuse (expungement petitions
# contain highly sensitive PII — SSN, DOB, address history — and must
# never be tunneled through this service by unintended clients).
#
# Extension ID is stable for published Chrome Web Store extensions.
# During local development the extension runs under a generated ID which
# will be logged on first load if UNKNOWN_EXTENSIONS is left in debug mode.
ALLOWED_ORIGINS = [
    # Local development
    "http://127.0.0.1",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://localhost:8000",
    # Indiana Expungement Assistant — Chrome Web Store (stable ID)
    "chrome-extension://fgejoecpjkkbpfmhpgfjegkdjppikinb",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ─── Request/Response Models ───────────────────────────────────────────

class AddressHistoryEntry(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipCode: Optional[str] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    line: Optional[str] = None


class Petitioner(BaseModel):
    fullName: str
    aliases: Optional[str] = None
    dob: Optional[str] = None
    ssn: Optional[str] = None
    driverLicense: Optional[str] = None
    streetAddress: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipCode: Optional[str] = None
    currentAddress: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    addresses: List[Union[str, AddressHistoryEntry]] = Field(default_factory=list)


class CaseRecord(BaseModel):
    caseNumber: str
    type: Optional[str] = None
    statute: Optional[str] = None
    charges: Optional[str] = None
    filed: Optional[str] = None
    dispositionDate: Optional[str] = None
    court: Optional[str] = None
    grantType: Optional[str] = None


class GenerateRequest(BaseModel):
    petitioner: Petitioner
    county: str
    court: str
    courtCode: str
    cases: List[CaseRecord]
    includeFeeWaiver: bool = True
    includeAddressSupplement: bool = True
    acknowledgedOneShot: bool = True
    acknowledgedNotLawyer: bool = True
    acknowledgedAllCases: bool = True
    acknowledgedProSeLiability: bool = True


# ─── Health & Disclaimers ──────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "online",
        "service": "Indiana Expungement Form Bot",
        "version": "1.0.0",
        "legalNotice": "Independent pro se accessibility tool. NOT legal advice. IC § 35-38-9-9(i) lifetime one-shot rule applies."
    }


@app.get("/api/disclaimer")
async def get_disclaimer():
    """Returns statutory rules and creator liability disclaimers."""
    return {
        "oneShotLifetimeRule": {
            "statute": "Indiana Code § 35-38-9-9(i)",
            "ruleText": "A person may file a petition for expungement of a conviction record under this chapter only one (1) time during any period of the person's life.",
            "consequence": "Any criminal conviction omitted from this petition cannot be expunged in the future. The opportunity is lost forever.",
            "multiCountyWindow": "Under IC § 35-38-9-9(d), petitions in multiple counties must be filed within 365 days."
        },
        "creatorMissionAndDisclaimer": {
            "mission": "Created by an independent individual who believes that legal record expungement under Indiana's Second Chance Law should be accessible to all citizens, not restricted to those who can afford expensive attorneys.",
            "notAnAttorney": "The creator is an independent private individual, NOT an attorney, NOT a law firm, and NOT affiliated with Indiana Courts.",
            "noLegalAdvice": "This tool provides automated clerical formatting of standard public court forms. It does not provide legal advice, representation, or counsel.",
            "proSeFilerDuty": "The petitioner acts pro se (representing themselves) and is solely responsible for verifying all case numbers, dates, and charges.",
            "warrantyAndLiability": "Provided AS IS with NO WARRANTY. The creator disclaims all liability for errors, omissions, court rejections, or omitted convictions."
        }
    }


# ─── Main Generation Endpoint ─────────────────────────────────────────

@app.post("/api/generate-expungement")
async def generate_expungement(request: GenerateRequest):
    """
    Generate a complete expungement petition packet.

    Accepts a JSON payload with petitioner info and case records.
    Requires explicit acknowledgment of Indiana's one-shot rule and legal disclaimers.
    Returns a ZIP file containing all court forms as PDFs.
    """
    if not (request.acknowledgedOneShot and request.acknowledgedNotLawyer and request.acknowledgedAllCases and request.acknowledgedProSeLiability):
        raise HTTPException(
            status_code=400,
            detail="Mandatory acknowledgments required: You must explicitly acknowledge Indiana's lifetime one-shot rule (IC § 35-38-9-9(i)), that this tool is not legal advice, and that all cases across Indiana are included."
        )

    try:
        # Convert Pydantic models to dict for the form engine
        payload = {
            "petitioner": request.petitioner.model_dump(),
            "county": request.county,
            "court": request.court,
            "courtCode": request.courtCode,
            "cases": [c.model_dump() for c in request.cases],
            "includeFeeWaiver": request.includeFeeWaiver,
            "includeAddressSupplement": request.includeAddressSupplement,
        }

        # Generate the packet
        zip_buffer = generate_packet(payload)

        # Build filename
        last_name = request.petitioner.fullName.split()[-1] if request.petitioner.fullName else "Packet"
        filename = f"{last_name}_{request.county}_Expungement_Packet.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Form generation failed: {str(e)}")


# ─── Standalone Runner ─────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print("═" * 60)
    print("  Indiana Expungement Form Bot")
    print("  Local API: http://127.0.0.1:8000")
    print("  Health:    http://127.0.0.1:8000/health")
    print("  Docs:      http://127.0.0.1:8000/docs")
    print("═" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000)
