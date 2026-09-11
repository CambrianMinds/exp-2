"""
Smoke test for the form engine.
Generates an end-to-end petition packet using synthetic mock data.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from form_engine import generate_packet

# Synthetic mock payload for testing form generation
test_payload = {
    "petitioner": {
        "fullName": "Jane Q. Public",
        "dob": "1988-03-15",
        "ssn": "XXX-XX-0000",
        "driverLicense": "9999-99-9999",
        "currentAddress": "100 North Senate Avenue, Indianapolis, IN 46204",
        "phone": "(317) 555-0100",
        "email": "jane.public@example.com",
        "addresses": [
            "100 North Senate Avenue, Indianapolis, IN 46204 (2020-Present)",
            "200 East Washington Street, Indianapolis, IN 46204 (2014-2020)",
            "300 South Meridian Street, Indianapolis, IN 46225 (2008-2014)"
        ]
    },
    "county": "Marion",
    "court": "Marion Superior Court - Criminal Division",
    "courtCode": "49D01",
    "cases": [
        {
            "caseNumber": "49D01-1405-F6-000101",
            "type": "F6 - Level 6 Felony",
            "statute": "IC § 35-38-9-3",
            "charges": "Theft (Level 6 Felony)",
            "filed": "05/10/2014",
            "dispositionDate": "11/15/2014",
            "court": "Marion Superior Court",
            "grantType": "mandatory"
        },
        {
            "caseNumber": "49D01-1608-CM-000202",
            "type": "CM - Class A Misdemeanor",
            "statute": "IC § 35-38-9-2",
            "charges": "Criminal Mischief (Class A Misdemeanor)",
            "filed": "08/14/2016",
            "dispositionDate": "10/01/2016",
            "court": "Marion Superior Court",
            "grantType": "mandatory"
        },
        {
            "caseNumber": "49D01-1903-IF-000303",
            "type": "IF - Infraction",
            "statute": "IC § 35-38-9-1",
            "charges": "Speeding (Exceeding Maximum Speed Limit)",
            "filed": "03/22/2019",
            "dispositionDate": "05/19/2019",
            "court": "Marion Superior Court",
            "grantType": "mandatory"
        },
        {
            "caseNumber": "49D01-1907-MC-000404",
            "type": "MC - Miscellaneous Criminal",
            "statute": "IC § 35-38-9-1",
            "charges": "Initial Hearing / Arrest Record (Charges Dismissed)",
            "filed": "07/11/2019",
            "dispositionDate": "07/15/2019",
            "court": "Marion Superior Court",
            "grantType": "mandatory"
        }
    ],
    "includeFeeWaiver": True,
    "includeAddressSupplement": True
}


def test_generate():
    print("=" * 60)
    print("  Form Engine Smoke Test")
    print("=" * 60)

    zip_buffer = generate_packet(test_payload)
    zip_bytes = zip_buffer.getvalue()

    print(f"\n[OK] ZIP generated successfully: {len(zip_bytes):,} bytes")

    # Inspect ZIP contents
    import zipfile
    with zipfile.ZipFile(zip_buffer) as zf:
        print(f"\n  ZIP Contents ({len(zf.namelist())} files):")
        for name in sorted(zf.namelist()):
            info = zf.getinfo(name)
            print(f"    {name:50s}  {info.file_size:>8,} bytes")

    # Save to disk for manual inspection
    output_path = os.path.join(os.path.dirname(__file__), 'test_output.zip')
    with open(output_path, 'wb') as f:
        f.write(zip_bytes)
    print(f"\n[OK] Saved test output to: {output_path}")
    print("\n" + "=" * 60)
    print("  ALL TESTS PASSED")
    print("=" * 60)


if __name__ == '__main__':
    test_generate()
