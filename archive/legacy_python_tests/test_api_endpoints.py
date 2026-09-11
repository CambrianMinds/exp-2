"""
Test FastAPI endpoints, legal disclaimers, and mandatory acknowledgment validation.
"""
import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import generate_expungement, GenerateRequest, Petitioner, CaseRecord, get_disclaimer
from fastapi import HTTPException


async def run_tests():
    print("=" * 60)
    print("  Testing App Endpoints & Legal Guardrails")
    print("=" * 60)

    # 1. Test Disclaimer endpoint
    disclaimer = await get_disclaimer()
    assert "oneShotLifetimeRule" in disclaimer
    assert disclaimer["oneShotLifetimeRule"]["statute"] == "Indiana Code § 35-38-9-9(i)"
    print("[OK] /api/disclaimer endpoint verified")

    # 2. Test rejection when one-shot rule is NOT acknowledged
    req_unacknowledged = GenerateRequest(
        petitioner=Petitioner(fullName="John Doe"),
        county="Marion",
        court="Marion Superior Court",
        courtCode="49D01",
        cases=[],
        acknowledgedOneShot=False,
        acknowledgedNotLawyer=True,
        acknowledgedAllCases=True,
        acknowledgedProSeLiability=True
    )

    try:
        await generate_expungement(req_unacknowledged)
        print("FAIL: Expected rejection due to unacknowledged one-shot rule")
        sys.exit(1)
    except HTTPException as e:
        assert e.status_code == 400
        print(f"[OK] Successfully rejected unacknowledged request (HTTP 400): {e.detail[:55]}...")

    # 3. Test successful generation with all acknowledgments checked
    req_valid = GenerateRequest(
        petitioner=Petitioner(
            fullName="Taylor Jordan Public",
            dob="1990-05-20",
            ssn="XXX-XX-0000",
            currentAddress="500 Sample Parkway, Indianapolis, IN 46204",
            addresses=["500 Sample Parkway, Indianapolis, IN 46204"]
        ),
        county="Marion",
        court="Marion Superior Court - Criminal Division",
        courtCode="49D01",
        cases=[
            CaseRecord(
                caseNumber="49D01-1605-CM-000555",
                type="CM - Class A Misdemeanor",
                statute="IC § 35-38-9-2",
                charges="Operating While Intoxicated",
                filed="2016-05-15",
                dispositionDate="2016-10-20",
                court="Marion Superior Court",
                grantType="mandatory"
            )
        ],
        acknowledgedOneShot=True,
        acknowledgedNotLawyer=True,
        acknowledgedAllCases=True,
        acknowledgedProSeLiability=True
    )

    response = await generate_expungement(req_valid)
    assert response.media_type == "application/zip"
    print("[OK] Successfully generated packet response with all acknowledgments verified")

    # 3. Test structured address fields (streetAddress, city, state, zipCode)
    req_structured_addr = GenerateRequest(
        petitioner=Petitioner(
            fullName="Jane Doe",
            dob="1985-06-15",
            ssn="000-00-0000",
            streetAddress="100 North Senate Avenue, Suite 200",
            city="Indianapolis",
            state="IN",
            zipCode="46204",
            phone="(317) 555-0199",
            email="petitioner@example.com"
        ),
        county="Marion",
        court="Marion Superior Court",
        courtCode="49D01",
        cases=[
            CaseRecord(
                caseNumber="49D01-1605-CM-000555",
                type="CM - Class A Misdemeanor",
                statute="IC § 35-38-9-2",
                charges="Operating While Intoxicated",
                filed="2016-05-15",
                dispositionDate="2016-10-20",
                court="Marion Superior Court",
                grantType="mandatory"
            )
        ],
        acknowledgedOneShot=True,
        acknowledgedNotLawyer=True,
        acknowledgedAllCases=True,
        acknowledgedProSeLiability=True
    )
    resp_structured = await generate_expungement(req_structured_addr)
    assert resp_structured.media_type == "application/zip"
    print("[OK] Successfully generated packet with structured address fields (street, city, state, zip)")

    # 4. Test petitioner with maiden name / aliases (IC § 35-38-9-8(b)(1))
    req_aliases = GenerateRequest(
        petitioner=Petitioner(
            fullName="Jane Doe",
            aliases="Jane Marie Smith, Jane M. Johnson",
            dob="1985-06-15",
            ssn="000-00-0000",
            streetAddress="100 North Senate Avenue, Suite 200",
            city="Indianapolis",
            state="IN",
            zipCode="46204"
        ),
        county="Marion",
        court="Marion Superior Court",
        courtCode="49D01",
        cases=[
            CaseRecord(
                caseNumber="49D01-1605-CM-000555",
                type="CM - Class A Misdemeanor",
                statute="IC § 35-38-9-2",
                charges="Operating While Intoxicated",
                filed="2016-05-15",
                dispositionDate="2016-10-20",
                court="Marion Superior Court",
                grantType="mandatory"
            )
        ],
        acknowledgedOneShot=True,
        acknowledgedNotLawyer=True,
        acknowledgedAllCases=True,
        acknowledgedProSeLiability=True
    )
    resp_aliases = await generate_expungement(req_aliases)
    assert resp_aliases.media_type == "application/zip"
    print("[OK] Successfully generated packet with maiden names / aliases (IC § 35-38-9-8(b)(1))")

    print("=" * 60)
    print("  ALL API & LEGAL GUARDRAIL TESTS PASSED")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(run_tests())
