"""
Indiana Expungement Form Engine — Parameterized Legal Document Generator
A dynamic legal document generation engine that accepts arbitrary petitioner data
and case arrays from the Chrome Extension.

Generates court-admissible .pdf documents for Indiana IC § 35-38-9 petitions.
"""

import os
import io
import zipfile
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# ─── Design Tokens ──────────────────────────────────────────────────────
PRIMARY = colors.HexColor('#1a365d')
SECONDARY = colors.HexColor('#2b6cb0')
DARK_GRAY = colors.HexColor('#2d3748')
LIGHT_BG = colors.HexColor('#f7fafc')
BORDER_COLOR = colors.HexColor('#cbd5e0')
HEADER_BG = colors.HexColor('#edf2f7')

# Warning & Disclaimer Tokens
ALERT_RED = colors.HexColor('#b91c1c')
ALERT_BG = colors.HexColor('#fef2f2')
ALERT_BORDER = colors.HexColor('#f87171')
WARN_AMBER = colors.HexColor('#92400e')
WARN_BG = colors.HexColor('#fffbeb')
WARN_BORDER = colors.HexColor('#fcd34d')

# ─── Indiana County FIPS → Name ────────────────────────────────────────
INDIANA_COUNTIES = {
    '01': 'Adams', '02': 'Allen', '03': 'Bartholomew', '04': 'Benton',
    '05': 'Blackford', '06': 'Boone', '07': 'Brown', '08': 'Carroll',
    '09': 'Cass', '10': 'Clark', '11': 'Clay', '12': 'Clinton',
    '13': 'Crawford', '14': 'Daviess', '15': 'Dearborn', '16': 'Decatur',
    '17': 'DeKalb', '18': 'Delaware', '19': 'Dubois', '20': 'Elkhart',
    '21': 'Fayette', '22': 'Floyd', '23': 'Fountain', '24': 'Franklin',
    '25': 'Fulton', '26': 'Gibson', '27': 'Grant', '28': 'Greene',
    '29': 'Hamilton', '30': 'Hancock', '31': 'Harrison', '32': 'Hendricks',
    '33': 'Henry', '34': 'Howard', '35': 'Huntington', '36': 'Jackson',
    '37': 'Jasper', '38': 'Jay', '39': 'Jefferson', '40': 'Jennings',
    '41': 'Johnson', '42': 'Knox', '43': 'Kosciusko', '44': 'LaGrange',
    '45': 'Lake', '46': 'LaPorte', '47': 'Lawrence', '48': 'Madison',
    '49': 'Marion', '50': 'Marshall', '51': 'Martin', '52': 'Miami',
    '53': 'Monroe', '54': 'Montgomery', '55': 'Morgan', '56': 'Newton',
    '57': 'Noble', '58': 'Ohio', '59': 'Orange', '60': 'Owen',
    '61': 'Parke', '62': 'Perry', '63': 'Pike', '64': 'Porter',
    '65': 'Posey', '66': 'Pulaski', '67': 'Putnam', '68': 'Randolph',
    '69': 'Ripley', '70': 'Rush', '71': 'St. Joseph', '72': 'Scott',
    '73': 'Shelby', '74': 'Spencer', '75': 'Starke', '76': 'Steuben',
    '77': 'Sullivan', '78': 'Switzerland', '79': 'Tippecanoe', '80': 'Tipton',
    '81': 'Union', '82': 'Vanderburgh', '83': 'Vermillion', '84': 'Vigo',
    '85': 'Wabash', '86': 'Warren', '87': 'Warrick', '88': 'Washington',
    '89': 'Wayne', '90': 'Wells', '91': 'White', '92': 'Whitley'
}


def get_county_name(court_code: str) -> str:
    """Extract county name from court code like '49D01' → 'Marion'."""
    import re
    m = re.match(r'^(\d+)', court_code or '')
    if m:
        return INDIANA_COUNTIES.get(m.group(1), f'County {m.group(1)}')
    return 'Unknown'


# ─── Numbered Canvas (page headers/footers) ────────────────────────────
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, petitioner_name='', court_name='', **kwargs):
        self._petitioner_name = petitioner_name
        self._court_name = court_name
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_decorations(num_pages)
            super().showPage()
        super().save()

    def _draw_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#718096'))

        if self._pageNumber > 1:
            header = f"In Re Expungement of {self._petitioner_name} | {self._court_name}"
            self.drawString(54, 750, header[:90])
            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)

        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.drawString(54, 36, "Indiana Expungement Packet - IC § 35-38-9 | Verified Petition & Pleadings")
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)

        self.restoreState()


# ─── PDF Style Factory ─────────────────────────────────────────────────
def get_pdf_styles():
    styles = getSampleStyleSheet()
    return {
        'caption': ParagraphStyle('CaptionStyle', parent=styles['Normal'],
                                  fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=DARK_GRAY),
        'title': ParagraphStyle('DocTitle', parent=styles['Normal'],
                                fontName='Helvetica-Bold', fontSize=12, leading=15, alignment=1,
                                textColor=PRIMARY, spaceAfter=10),
        'subtitle': ParagraphStyle('DocSubtitle', parent=styles['Normal'],
                                   fontName='Helvetica-Bold', fontSize=9.5, leading=13, alignment=1,
                                   textColor=DARK_GRAY, spaceAfter=12),
        'body': ParagraphStyle('LegalBody', parent=styles['Normal'],
                               fontName='Helvetica', fontSize=9, leading=13,
                               textColor=DARK_GRAY, spaceAfter=6),
        'body_bold': ParagraphStyle('LegalBodyBold', parent=styles['Normal'],
                                    fontName='Helvetica-Bold', fontSize=9, leading=13,
                                    textColor=DARK_GRAY, spaceAfter=6),
        'heading': ParagraphStyle('SectionHeading', parent=styles['Normal'],
                                  fontName='Helvetica-Bold', fontSize=9.5, leading=13,
                                  textColor=PRIMARY, spaceBefore=8, spaceAfter=4),
        'tbl_header': ParagraphStyle('TblHeader', parent=styles['Normal'],
                                     fontName='Helvetica-Bold', fontSize=8, leading=10,
                                     alignment=1, textColor=PRIMARY),
        'tbl_cell': ParagraphStyle('TblCell', parent=styles['Normal'],
                                   fontName='Helvetica', fontSize=7.5, leading=10, textColor=DARK_GRAY),
        'tbl_cell_bold': ParagraphStyle('TblCellBold', parent=styles['Normal'],
                                        fontName='Helvetica-Bold', fontSize=7.5, leading=10,
                                        textColor=DARK_GRAY),
        'tbl_cell_center': ParagraphStyle('TblCellCenter', parent=styles['Normal'],
                                          fontName='Helvetica', fontSize=7.5, leading=10,
                                          alignment=1, textColor=DARK_GRAY),
        'alert_title': ParagraphStyle('AlertTitle', parent=styles['Normal'],
                                      fontName='Helvetica-Bold', fontSize=10, leading=13,
                                      alignment=1, textColor=ALERT_RED),
        'alert_body': ParagraphStyle('AlertBody', parent=styles['Normal'],
                                     fontName='Helvetica', fontSize=8, leading=11.5,
                                     textColor=DARK_GRAY, spaceAfter=4),
        'alert_body_bold': ParagraphStyle('AlertBodyBold', parent=styles['Normal'],
                                          fontName='Helvetica-Bold', fontSize=8, leading=11.5,
                                          textColor=ALERT_RED, spaceAfter=4),
        'alert_bullet': ParagraphStyle('AlertBullet', parent=styles['Normal'],
                                       fontName='Helvetica', fontSize=8, leading=11.5,
                                       leftIndent=12, firstLineIndent=-8,
                                       textColor=DARK_GRAY, spaceAfter=3),
        'disclaimer_title': ParagraphStyle('DisclaimerTitle', parent=styles['Normal'],
                                           fontName='Helvetica-Bold', fontSize=9.5, leading=12,
                                           textColor=PRIMARY, spaceAfter=3),
        'disclaimer_body': ParagraphStyle('DisclaimerBody', parent=styles['Normal'],
                                          fontName='Helvetica', fontSize=8, leading=11,
                                          textColor=DARK_GRAY, spaceAfter=4),
    }


# ─── Reusable Components ───────────────────────────────────────────────

def make_court_caption(st, petitioner_name: str, county_name: str, court_name: str,
                       court_code: str, cause_str: str = None, doc_title_code: str = "XP - EXPUNGEMENT PETITION",
                       aliases: str = None):
    """Generate the standard Indiana court caption block."""
    if not cause_str:
        cause_str = f"CAUSE NO. {court_code}-____-XP-______"

    aka_block = f"<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>a/k/a {aliases}</i>" if aliases else ""
    left_p = Paragraph(
        f"<b>STATE OF INDIANA</b><br/>"
        f"<b>COUNTY OF {county_name.upper()}</b><br/><br/>"
        f"<b>IN RE THE EXPUNGEMENT OF THE<br/>"
        f"ARREST AND CONVICTION RECORDS OF:</b><br/><br/>"
        f"<b>{petitioner_name.upper()}</b>{aka_block},<br/>"
        f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>Petitioner.</i>",
        st['caption']
    )
    right_p = Paragraph(
        f"<b>IN THE {court_name.upper()}</b><br/><br/>"
        f"<b>{cause_str}</b><br/><br/>"
        f"<b>{doc_title_code}</b>",
        st['caption']
    )
    tbl = Table([[left_p, right_p]], colWidths=[250, 254])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('LINEBELOW', (0, 0), (-1, -1), 1, PRIMARY),
    ]))
    return tbl


def _format_address_line(address: dict) -> str:
    street = (address.get('street') or '').strip()
    city = (address.get('city') or '').strip()
    state = (address.get('state') or '').strip()
    zip_code = (address.get('zipCode') or address.get('zip') or '').strip()
    return ', '.join(part for part in [street, city, f"{state} {zip_code}".strip()] if part)


def _normalize_address_history_entry(value) -> dict:
    if isinstance(value, dict):
        address = {
            'street': value.get('street') or value.get('streetAddress') or '',
            'city': value.get('city') or '',
            'state': value.get('state') or '',
            'zipCode': value.get('zipCode') or value.get('zip') or '',
            'fromDate': value.get('fromDate') or value.get('from') or '',
            'toDate': value.get('toDate') or value.get('to') or '',
            'line': value.get('line') or ''
        }
        address['line'] = address['line'] or _format_address_line(address)
        return address

    return {
        'street': str(value or '').strip(),
        'city': '',
        'state': '',
        'zipCode': '',
        'fromDate': '',
        'toDate': '',
        'line': str(value or '').strip()
    }


def _format_residence_dates(address: dict) -> str:
    start = (address.get('fromDate') or '').strip()
    end = (address.get('toDate') or '').strip()
    if start and end:
        return f"{start} to {end}"
    if start:
        return f"{start} to _________"
    if end:
        return f"_________ to {end}"
    return "_________ to _________"


def build_case_table(st, cases: list, for_order: bool = False):
    """Build the master case roster table from dynamic case data."""
    data = []
    if for_order:
        data.append([
            Paragraph("<b>No.</b>", st['tbl_header']),
            Paragraph("<b>Cause Number & Court</b>", st['tbl_header']),
            Paragraph("<b>Offense / Charge</b>", st['tbl_header']),
            Paragraph("<b>Disposition Date</b>", st['tbl_header']),
            Paragraph("<b>Sealing Authority</b>", st['tbl_header'])
        ])
        for i, c in enumerate(cases, 1):
            data.append([
                Paragraph(f"<b>{i}</b>", st['tbl_cell_center']),
                Paragraph(f"<b>{c.get('caseNumber', '')}</b><br/>{c.get('court', '')}", st['tbl_cell']),
                Paragraph(c.get('charges', ''), st['tbl_cell']),
                Paragraph(c.get('dispositionDate', c.get('filed', '')), st['tbl_cell']),
                Paragraph(f"<b>{c.get('statute', '')}</b>", st['tbl_cell_bold'])
            ])
    else:
        data.append([
            Paragraph("<b>No.</b>", st['tbl_header']),
            Paragraph("<b>Cause Number & Court</b>", st['tbl_header']),
            Paragraph("<b>Record Type & Charges</b>", st['tbl_header']),
            Paragraph("<b>Filing & Disposition</b>", st['tbl_header']),
            Paragraph("<b>Governing Statute</b>", st['tbl_header'])
        ])
        for i, c in enumerate(cases, 1):
            data.append([
                Paragraph(f"<b>{i}</b>", st['tbl_cell_center']),
                Paragraph(f"<b>{c.get('caseNumber', '')}</b><br/>{c.get('court', '')}", st['tbl_cell']),
                Paragraph(f"<b>{c.get('type', '')}</b><br/>{c.get('charges', '')}", st['tbl_cell']),
                Paragraph(f"Filed: {c.get('filed', '')}<br/>{c.get('dispositionDate', '')}", st['tbl_cell']),
                Paragraph(f"<b>{c.get('statute', '')}</b>", st['tbl_cell'])
            ])

    col_w = [24, 120, 160, 100, 100]
    tbl = Table(data, colWidths=col_w, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return tbl


# ─── Individual Form Generators (Parameterized) ────────────────────────

def _ctx(payload: dict):
    """Extract common context variables from the payload."""
    raw_pet = payload.get('petitioner', {}) or {}
    pet = {
        'fullName': raw_pet.get('fullName') or 'PETITIONER NAME',
        'aliases': raw_pet.get('aliases') or '',
        'dob': raw_pet.get('dob') or '_______ / _______ / ______________',
        'ssn': raw_pet.get('ssn') or 'XXX - XX - ________________',
        'driverLicense': raw_pet.get('driverLicense') or '________________________________________',
        'currentAddress': (
            raw_pet.get('currentAddress') or
            (', '.join(filter(None, [
                raw_pet.get('streetAddress', '').strip(),
                raw_pet.get('city', '').strip(),
                f"{raw_pet.get('state', 'IN').strip()} {raw_pet.get('zipCode', '').strip()}".strip()
            ])) or None) or
            '____________________________________________________________________'
        ),
        'phone': raw_pet.get('phone') or '______________________________',
        'email': raw_pet.get('email') or '______________________________',
        'addresses': [_normalize_address_history_entry(addr) for addr in (raw_pet.get('addresses') or [])]
    }
    name = pet['fullName']
    name_upper = name.upper()
    county = payload.get('county') or 'Unknown'
    court = payload.get('court') or 'Unknown Court'
    court_code = payload.get('courtCode') or 'XXXXX'
    cases = payload.get('cases') or []
    addresses = pet['addresses']
    return name, name_upper, county, court, court_code, cases, pet, addresses


def generate_form_0(st, payload):
    """Form 00: Critical Lifetime One-Shot Warning, Legal Disclaimers & Pro Se Filing Instructions."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    n_cases = len(cases)
    story = []

    # Document Header
    story.append(Paragraph("<b>STATE OF INDIANA · SECOND CHANCE ACT (IC § 35-38-9)</b>", st['subtitle']))
    story.append(Paragraph("<b>CRITICAL LEGAL NOTICE, LIFETIME ONE-SHOT WARNING &amp; FILING GUIDE</b>", st['title']))
    story.append(Paragraph(f"<b>PETITIONER:</b> {name_upper} | <b>COUNTY:</b> {county.upper()} | <b>CASES:</b> {n_cases}", st['caption']))
    story.append(Spacer(1, 8))

    # 1. THE ONE-SHOT LIFETIME EXPUNGEMENT RULE ALERT BOX
    one_shot_p = [
        Paragraph("<b>STOP AND READ FIRST: INDIANA'S LIFETIME ONE-SHOT EXPUNGEMENT RULE</b>", st['alert_title']),
        Spacer(1, 4),
        Paragraph(
            "<b>STATUTORY MANDATE — INDIANA CODE § 35-38-9-9(i):</b><br/>"
            "<i>&ldquo;A person may file a petition for expungement of a conviction record under this chapter "
            "only one (1) time during any period of the person's life.&rdquo;</i>",
            st['alert_body_bold']
        ),
        Paragraph(
            "<b>1. OMITTING A CONVICTION IS PERMANENT AND FATAL:</b> Indiana law grants you <b>ONLY ONE OPPORTUNITY</b> "
            "in your entire lifetime to petition for the expungement of criminal conviction records (misdemeanors or felonies). "
            "If you have criminal convictions anywhere in Indiana that are eligible or nearing eligibility, and you neglect "
            "or forget to include them in your expungement petition(s), <b>YOU WILL PERMANENTLY FORFEIT YOUR RIGHT TO EVER "
            "EXPUNGE THOSE CONVICTIONS FOR THE REST OF YOUR LIFE.</b> The court cannot grant a second expungement petition later.",
            st['alert_bullet']
        ),
        Paragraph(
            "<b>2. MULTIPLE COUNTIES (THE 365-DAY MANDATORY WINDOW):</b> Under <b>IC § 35-38-9-9(d)</b>, if you have criminal "
            "convictions in more than one Indiana county, all petitions across all counties must be filed within a "
            "<b>365-day statutory window</b>, or consolidated into a single proceeding. Filing a petition in this county "
            "triggers that lifetime clock. If you fail to file in other counties within this period, you lose the right to expunge those records forever.",
            st['alert_bullet']
        ),
        Paragraph(
            "<b>3. MANDATORY COMPREHENSIVE NAME &amp; RECORD SEARCH:</b> Before you sign and file, you MUST verify that you "
            "searched the Indiana court database (<b>mycase.in.gov</b>) for: "
            "(a) Your current full legal name; "
            "(b) Any previous married names or maiden names; "
            "(c) Any legal name changes, aliases, middle-name-only listings, or nicknames; "
            "(d) Across <b>ALL 92 Indiana counties</b> where you have ever resided, worked, visited, or been arrested.",
            st['alert_bullet']
        ),
        Paragraph(
            "<b>4. DO NOT FILE IF YOU HAVE UNRESOLVED OR RECENT CONVICTIONS:</b> If you have any pending criminal charges, "
            "or convictions that have not yet reached their statutory waiting periods (5 years for misdemeanors, 8 years for "
            "Class D / Level 6 felonies), filing now may permanently disqualify you from ever expunging those newer records later.",
            st['alert_bullet']
        ),
    ]
    tbl_one_shot = Table([[one_shot_p]], colWidths=[504])
    tbl_one_shot.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), ALERT_BG),
        ('BOX', (0, 0), (-1, -1), 1.5, ALERT_RED),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(tbl_one_shot)
    story.append(Spacer(1, 10))

    # 2. LEGAL DISCLAIMER & NON-ATTORNEY STATEMENT ("COVER MY ASS")
    disclaimer_p = [
        Paragraph("<b>LEGAL DISCLAIMER: NOT LEGAL ADVICE · INDEPENDENT PRO SE SELF-HELP TOOL</b>", st['disclaimer_title']),
        Spacer(1, 3),
        Paragraph(
            "<b>CREATOR'S MISSION &amp; PUBLIC ACCESSIBILITY STATEMENT:</b><br/>"
            "This automated petition preparation software was conceived and built by an independent individual who believes that legal "
            "second chances and the Indiana expungement process should be transparent, accessible, and achievable for every "
            "ordinary citizen—not locked behind thousands of dollars in attorney fees. Navigating court rules is intimidating, "
            "and this project is an independent effort to democratize access to standard court forms.",
            st['disclaimer_body']
        ),
        Paragraph(
            "<b>1. NOT AN ATTORNEY / NO LEGAL SERVICES:</b> The creator and maintainer of this software is <b>NOT AN ATTORNEY</b>, "
            "is NOT licensed to practice law in Indiana or any other jurisdiction, is NOT a law firm, and is NOT a legal aid organization. "
            "This software does not provide legal representation, legal advice, legal strategy, or case assessments.",
            st['disclaimer_body']
        ),
        Paragraph(
            "<b>2. NO ATTORNEY-CLIENT RELATIONSHIP:</b> Your use of this tool and receipt of these generated forms DOES NOT create "
            "an attorney-client relationship between you and the creator. You are proceeding <b>PRO SE</b> (representing yourself).",
            st['disclaimer_body']
        ),
        Paragraph(
            "<b>3. NO WARRANTIES &amp; COMPLETE RELEASE OF LIABILITY:</b> This tool and all accompanying documents are provided "
            "&ldquo;AS IS&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. The creator disclaims all warranties of merchantability, "
            "fitness for a particular purpose, and accuracy. The creator assumes <b>ZERO LEGAL LIABILITY</b> for any clerical errors, "
            "court dismissals, prosecutorial objections, filing rejections, statutory miscalculations, or omitted convictions. "
            "By using these documents, you expressly waive and release the creator from any and all legal claims, damages, or liabilities.",
            st['disclaimer_body']
        ),
        Paragraph(
            "<b>4. USER'S SOLE DUTY TO AUDIT &amp; VERIFY:</b> You bear 100% of the responsibility to verify every single cause number, "
            "charge, date of conviction, statutory section, and personal identifier against official court records prior to signing "
            "under penalties of perjury and filing with the Court Clerk.",
            st['disclaimer_body']
        ),
    ]
    tbl_disclaimer = Table([[disclaimer_p]], colWidths=[504])
    tbl_disclaimer.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, SECONDARY),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(tbl_disclaimer)
    story.append(Spacer(1, 10))

    # Page Break for Filing Instructions & Inventory
    story.append(PageBreak())

    story.append(Paragraph("<b>EXPUNGEMENT PACKET INVENTORY &amp; STEP-BY-STEP FILING GUIDE</b>", st['heading']))
    story.append(Paragraph(
        "Follow these exact steps to complete your filing with the Court Clerk and serve the Prosecuting Attorney:",
        st['body']
    ))
    story.append(Spacer(1, 4))

    # Inventory Table
    inv_data = [
        [Paragraph("<b>File Name</b>", st['tbl_header']),
         Paragraph("<b>Description &amp; Action Required</b>", st['tbl_header'])],
        [Paragraph("<b>01_Appearance_Form.pdf</b>", st['tbl_cell_bold']),
         Paragraph("Tells the court you are representing yourself pro se. Sign and file with Court Clerk.", st['tbl_cell'])],
        [Paragraph("<b>02_Notice_of_Exclusion_Confidential_Info.pdf</b>", st['tbl_cell_bold']),
         Paragraph("Notice under Access to Court Records Rule 5 that sensitive PII is filed under seal.", st['tbl_cell'])],
        [Paragraph("<b>03_Confidential_Information_Sheet.pdf</b>", st['tbl_cell_bold']),
         Paragraph("Contains SSN, DOB, DL#, and residential history. Print on <b>LIGHT GREEN PAPER</b> (or clearly mark 'CONFIDENTIAL') and submit in a sealed envelope.", st['tbl_cell'])],
        [Paragraph("<b>04_Verified_Petition_for_Expungement.pdf</b>", st['tbl_cell_bold']),
         Paragraph("The primary petition. Review all cases. Sign the Verification under penalty of perjury in ink.", st['tbl_cell'])],
        [Paragraph("<b>05_Notice_of_Filing_to_Prosecutor.pdf</b>", st['tbl_cell_bold']),
         Paragraph("Mandatory notice delivered to the County Prosecuting Attorney pursuant to IC § 35-38-9-9(g).", st['tbl_cell'])],
        [Paragraph("<b>06_Certificate_of_Service.pdf</b>", st['tbl_cell_bold']),
         Paragraph("Proof of service on the Prosecutor. Fill in delivery date, sign, and file with Court Clerk.", st['tbl_cell'])],
        [Paragraph("<b>07_Proposed_Order_Granting_Expungement.pdf</b>", st['tbl_cell_bold']),
         Paragraph("The formal order for the Judge to review, approve, and sign.", st['tbl_cell'])],
        [Paragraph("<b>08_Fee_Waiver_Request_and_Order.pdf</b>", st['tbl_cell_bold']),
         Paragraph("Optional: Indigency fee waiver petition if you cannot afford the civil filing fee (~$157).", st['tbl_cell'])],
    ]
    tbl_inv = Table(inv_data, colWidths=[180, 324])
    tbl_inv.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(tbl_inv)
    story.append(Spacer(1, 10))

    # Steps List
    steps = [
        ("Step 1: Conduct Your Final Record Audit",
         "Carefully review every case number, offense date, and disposition date listed in Form 04. Confirm that NO CONVICTIONS from this county were left off. Remember: you only get this one lifetime chance!"),
        ("Step 2: Sign and Date All Pleading Documents",
         "Sign the Appearance (Form 01), Verified Petition (Form 04), and Certificate of Service (Form 06) in blue or black ink. Form 04 is signed under penalties of perjury."),
        ("Step 3: Serve the County Prosecuting Attorney",
         f"Under IC § 35-38-9-9(g), you MUST deliver a complete copy of the Petition (Forms 01, 02, 04, 05, and 07) to the Prosecuting Attorney's Office of {county} County. You may serve by hand delivery, certified mail, or through the Indiana E-Filing System (IEFS)."),
        ("Step 4: File the Original Packet with the Court Clerk",
         f"File the petition packet with the Clerk of the Court in {county} County. If filing in person, bring the original and at least two (2) copies (one for court, one for prosecutor, one stamped copy for your records). If filing online, use Odyssey File & Serve (in.gov/courts/efile)."),
        ("Step 5: Pay Filing Fee or Submit Fee Waiver",
         "Expungement petitions for convictions require a civil filing fee (typically $157 in Indiana). If you have low income or receive public assistance, submit Form 08 (Fee Waiver Request) along with your filing."),
        ("Step 6: Monitor Your Case & Wait for the Order",
         "The Prosecutor has thirty (30) days from service to file an objection. If all statutory requirements are satisfied and no objection is filed, the Court may grant the expungement order without a hearing. Once signed, the Clerk will distribute the order to the Indiana State Police Central Repository, BMV, and law enforcement agencies to restrict public access."),
    ]

    for title, desc in steps:
        story.append(Paragraph(f"<b>{title}:</b> {desc}", st['body']))

    return story


def generate_form_1(st, payload):
    """Form 01: Appearance by Self-Represented Person."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>APPEARANCE BY SELF-REPRESENTED PERSON IN CIVIL CASE</b>", st['title']))

    story.append(Paragraph("<b>1. Party Information:</b>", st['heading']))
    story.append(Paragraph(
        f"The Petitioner, <b>{name}</b>, hereby enters his appearance <i>pro se</i> "
        f"(self-represented) in the above-captioned expungement proceeding pursuant to Indiana Trial Rule 3.1.",
        st['body']))

    info_data = [
        [Paragraph("<b>Name:</b>", st['tbl_cell_bold']), Paragraph(name, st['tbl_cell'])],
        [Paragraph("<b>Current Physical Address:</b>", st['tbl_cell_bold']),
         Paragraph(pet.get('currentAddress', '____________________________________________________________________'), st['tbl_cell'])],
        [Paragraph("<b>Telephone Number:</b>", st['tbl_cell_bold']),
         Paragraph(pet.get('phone', '________________________________________'), st['tbl_cell'])],
        [Paragraph("<b>Email Address:</b>", st['tbl_cell_bold']),
         Paragraph(pet.get('email', '________________________________________'), st['tbl_cell'])],
    ]
    t = Table(info_data, colWidths=[140, 364])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_BG),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>2. Case Type & Nature of Proceeding:</b>", st['heading']))
    story.append(Paragraph(
        "This is a civil Miscellaneous proceeding for the <b>Expungement of Conviction and Arrest Records "
        "(Case Type: XP)</b> pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, and 35-38-9-8.",
        st['body']))

    story.append(Paragraph("<b>3. Service Information:</b>", st['heading']))
    story.append(Paragraph(
        "Petitioner accepts service of all court documents and notices at the postal address and/or "
        "email address provided above, or via the Indiana Odyssey E-Filing System (IEFS).",
        st['body']))

    story.append(Paragraph("<b>4. Representation Status:</b>", st['heading']))
    story.append(Paragraph("Petitioner is representing himself in this matter and is not represented by legal counsel.", st['body']))
    story.append(Spacer(1, 15))

    story.append(Paragraph("Respectfully submitted,", st['body']))
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"____________________________________________________________<br/>"
        f"<b>{name_upper}</b>, Petitioner Pro Se<br/>Date: ________________________",
        st['body']))
    return story


def generate_form_2(st, payload):
    """Form 02: Notice of Exclusion of Confidential Information."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>FORM ACR - NOTICE OF EXCLUSION OF CONFIDENTIAL INFORMATION FROM PUBLIC ACCESS</b>", st['title']))
    story.append(Paragraph("(PURSUANT TO INDIANA RULES ON ACCESS TO COURT RECORDS, RULE 5)", st['subtitle']))

    story.append(Paragraph(
        f"Pursuant to the <b>Indiana Rules on Access to Court Records (Rule 5)</b>, Petitioner, <b>{name}</b>, "
        f"gives notice that the accompanying <i>Confidential Information Supplement</i> contains confidential "
        f"identifying information that is excluded from public access under Indiana law, and states as follows:",
        st['body']))

    story.append(Paragraph("<b>1. Social Security Number and Driver's License Number:</b>", st['heading']))
    story.append(Paragraph(
        "The Petitioner's complete Social Security Number is excluded from public access pursuant to "
        "<b>Access to Court Records Rule 5(C)(1)</b>. Social Security Number and Driver's License/Identification "
        "Number are supplied for court review because <b>Indiana Code § 35-38-9-8(b)(8)(A)-(B)</b> requires them.",
        st['body']))

    story.append(Paragraph("<b>2. Complete Date of Birth:</b>", st['heading']))
    story.append(Paragraph(
        "The Petitioner's complete Date of Birth is supplied for court review because "
        "<b>Indiana Code § 35-38-9-8(b)(2)</b> requires it.",
        st['body']))

    story.append(Paragraph("<b>3. Historical Residential Addresses:</b>", st['heading']))
    story.append(Paragraph(
        "The Petitioner's chronological residential address history from the date of the earliest offense to the present "
        "is submitted on the separate Confidential Information Supplement in compliance with <b>Access to Court Records Rule 5(B)</b> "
        "and <b>Indiana Code § 35-38-9-8(b)(3)</b>.",
        st['body']))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "A separate, unredacted <b>Confidential Information Supplement</b> is being filed contemporaneously with this "
        "Notice and the Verified Petition for Expungement on light green paper (if filed on paper) or marked as confidential "
        "(if filed via IEFS) in accordance with Access to Court Records Rule 5.",
        st['body']))
    story.append(Spacer(1, 20))

    story.append(Paragraph("Respectfully submitted,", st['body']))
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>{name_upper}</b>, Petitioner Pro Se<br/>Date: ________________________",
        st['body']))
    return story


def generate_form_3(st, payload):
    """Form 03: Confidential Information Supplement."""
    name, name_upper, county, court, court_code, cases, pet, addresses = _ctx(payload)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>CONFIDENTIAL INFORMATION SUPPLEMENT</b>", st['title']))
    story.append(Paragraph(
        "<b>CONFIDENTIAL PER ACCESS TO COURT RECORDS RULE 5</b><br/>"
        "<b>[NON-PUBLIC ACCESS VERSION / NOT FOR PUBLIC ACCESS]</b><br/>"
        "Submitted with Form ACR and IC § 35-38-9-8 petition requirements",
        ParagraphStyle('ConfAlert', parent=st['subtitle'], textColor=colors.HexColor('#c53030'))))

    story.append(Paragraph("<b>I. PETITIONER PERSONAL IDENTIFIERS:</b>", st['heading']))

    dob_display = pet.get('dob', '_______ / _______ / ______________')
    ssn_display = pet.get('ssn', 'XXX - XX - ________________')
    dl_display = pet.get('driverLicense', '________________________________________')

    id_data = [
        [Paragraph("<b>Full Legal Name:</b>", st['tbl_cell_bold']), Paragraph(name, st['tbl_cell'])],
        [Paragraph("<b>Other Names / Maiden Names / Aliases:</b>", st['tbl_cell_bold']),
         Paragraph(pet.get('aliases') or 'None', st['tbl_cell'])],
        [Paragraph("<b>Date of Birth:</b>", st['tbl_cell_bold']), Paragraph(dob_display, st['tbl_cell'])],
        [Paragraph("<b>Social Security Number:</b>", st['tbl_cell_bold']), Paragraph(ssn_display, st['tbl_cell'])],
        [Paragraph("<b>Driver's License / ID Number:</b>", st['tbl_cell_bold']),
         Paragraph(f"{dl_display} &nbsp;&nbsp; <b>State:</b> Indiana", st['tbl_cell'])],
        [Paragraph("<b>Current Physical Address:</b>", st['tbl_cell_bold']),
         Paragraph(pet.get('currentAddress', '____________________________________________________________________'), st['tbl_cell'])],
        [Paragraph("<b>Telephone &amp; Email:</b>", st['tbl_cell_bold']),
         Paragraph(f"Phone: {pet.get('phone', '______________________________')} &nbsp;&nbsp; Email: {pet.get('email', '______________________________')}", st['tbl_cell'])],
    ]
    t_id = Table(id_data, colWidths=[150, 354])
    t_id.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_BG),
    ]))
    story.append(t_id)
    story.append(Spacer(1, 4))

    story.append(Paragraph("<b>II. RESIDENTIAL HISTORY:</b>", st['heading']))
    story.append(Paragraph(
        "<i>(Required by IC § 35-38-9-8(b)(3) from date of earliest offense to present.)</i>",
        st['tbl_cell']))

    res_data = [
        [Paragraph("<b>No.</b>", st['tbl_header']),
         Paragraph("<b>Street Address</b>", st['tbl_header']),
         Paragraph("<b>City</b>", st['tbl_header']),
         Paragraph("<b>State</b>", st['tbl_header']),
         Paragraph("<b>ZIP</b>", st['tbl_header']),
         Paragraph("<b>Approx. Dates</b>", st['tbl_header'])],
    ]

    # Fill with provided addresses or blank lines
    num_rows = max(5, len(addresses))
    for i in range(num_rows):
        addr = addresses[i] if i < len(addresses) else {}
        street = addr.get('street') or addr.get('line') or "________________________________"
        city = addr.get('city') or "________________"
        state = addr.get('state') or "____"
        zip_code = addr.get('zipCode') or "__________"
        res_data.append([
            Paragraph(f"<b>{i + 1}</b>", st['tbl_cell_center']),
            Paragraph(street, st['tbl_cell']),
            Paragraph(city, st['tbl_cell']),
            Paragraph(state, st['tbl_cell_center']),
            Paragraph(zip_code, st['tbl_cell']),
            Paragraph(_format_residence_dates(addr), st['tbl_cell'])
        ])

    t_res = Table(res_data, colWidths=[24, 190, 95, 38, 57, 100])
    t_res.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ]))
    story.append(t_res)
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>AFFIRMATION UNDER PENALTIES FOR PERJURY</b>", st['heading']))
    story.append(Paragraph(
        "I affirm, under the penalties for perjury, that the foregoing representations, personal identifiers, "
        "and address history provided on this Confidential Information Supplement are true and correct to the best of my knowledge and belief.",
        st['body']))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>{name_upper}</b>, Petitioner<br/>Date: ________________________",
        st['body']))
    return story


def generate_form_4(st, payload):
    """Form 04: Verified Petition for Expungement."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    n_cases = len(cases)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code, aliases=pet.get('aliases') or None))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>VERIFIED PETITION FOR EXPUNGEMENT OF ARREST, INFRACTION, MISDEMEANOR, AND FELONY RECORDS</b>",
        st['title']))
    story.append(Paragraph("(PURSUANT TO IC § 35-38-9-1, § 35-38-9-2, § 35-38-9-3, &amp; § 35-38-9-8)", st['subtitle']))

    # Determine what record types are present
    has_felony = any(c.get('type', '').startswith(('FD', 'DF', 'F6', 'F5', 'F4', 'F3', 'F2', 'F1', 'FA', 'FB', 'FC')) for c in cases)
    has_misdemeanor = any(c.get('type', '').startswith('CM') for c in cases)
    has_infraction = any(c.get('type', '').startswith(('IF', 'MC')) for c in cases)

    record_types = []
    if has_infraction:
        record_types.append("arrest, infraction")
    if has_misdemeanor:
        record_types.append("misdemeanor")
    if has_felony:
        record_types.append("Class D felony conviction")
    records_str = ", ".join(record_types) if record_types else "criminal"

    story.append(Paragraph(
        f"Comes now Petitioner, <b>{name}</b>, <i>pro se</i>, and respectfully petitions this Honorable Court for "
        f"the expungement and permanent sealing of his {records_str} records "
        f"pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, and 35-38-9-8. "
        f"In support of this Petition, Petitioner affirms under penalties of perjury as follows:",
        st['body']))

    story.append(Paragraph("<b>I. PETITIONER IDENTIFICATION &amp; JURISDICTION</b>", st['heading']))
    aliases_stmt = f" All other legal names, maiden names, prior married names, or aliases by which Petitioner has been known pursuant to IC § 35-38-9-8(b)(1) are: <b>{pet['aliases']}</b>." if pet.get('aliases') else " Petitioner has had no other legal names, maiden names, or aliases (IC § 35-38-9-8(b)(1))."
    story.append(Paragraph(
        f"<b>1. Petitioner's Identity:</b> Petitioner's full legal name is {name}.{aliases_stmt}",
        st['body']))
    story.append(Paragraph(
        f"<b>2. Confidential Identifying Information:</b> Pursuant to IC § 35-38-9-8(b) and Access to Court Records Rule 5, "
        f"Petitioner's complete Date of Birth, Social Security Number, State Driver's License Number, and chronological "
        f"residential history from the earliest offense to the present are filed contemporaneously on the separate "
        f"Confidential Information Supplement under seal.",
        st['body']))
    story.append(Paragraph(
        f"<b>3. Jurisdiction &amp; Venue:</b> Venue and jurisdiction are proper in the {court} pursuant to "
        f"IC § 35-38-9-8, as all underlying criminal charges, misdemeanor convictions, arrest records, and traffic infractions "
        f"originated and were adjudicated in {county} County, Indiana.",
        st['body']))
    story.append(Paragraph(
        f"<b>4. Mandatory Consolidation &amp; Lifetime One-Shot Rule:</b> Pursuant to IC § 35-38-9-8(a) and "
        f"IC § 35-38-9-9(i), Petitioner has consolidated all known criminal convictions, arrests, and infractions from "
        f"{county} County into this single, comprehensive Verified Petition. Petitioner explicitly affirms and acknowledges "
        f"that under Indiana law, a person may file for expungement of a conviction record only one (1) time during any period "
        f"of the person's life, and that all eligible conviction records originating in {county} County are presented herein.",
        st['body']))

    story.append(Paragraph("<b>II. MASTER ROSTER OF RECORDS SOUGHT TO BE EXPUNGED</b>", st['heading']))
    story.append(Paragraph(
        f"<b>5. Summary of Subject Matters:</b> Petitioner requests the permanent expungement and sealing of the "
        f"following {_num_word(n_cases)} ({n_cases}) matters originating in {county} County, Indiana:",
        st['body']))
    story.append(Spacer(1, 4))
    story.append(build_case_table(st, cases, for_order=False))
    story.append(Spacer(1, 6))

    # Statutory eligibility paragraphs
    story.append(Paragraph("<b>III. STATUTORY ELIGIBILITY &amp; MANDATORY FINDINGS</b>", st['heading']))

    # Group cases by statute
    sect1_cases = [c for c in cases if c.get('statute', '').endswith('-1')]
    sect2_cases = [c for c in cases if c.get('statute', '').endswith('-2')]
    sect3_cases = [c for c in cases if c.get('statute', '').endswith('-3')]

    para_num = 6
    if sect1_cases:
        cause_list = ", ".join(c['caseNumber'] for c in sect1_cases)
        story.append(Paragraph(
            f"<b>{para_num}. Eligibility under IC § 35-38-9-1 (Arrests &amp; Non-Convictions / Infractions):</b> "
            f"For Cause Nos. {cause_list}, more than one (1) year has elapsed since disposition. "
            f"There are no charges currently pending against Petitioner. Pursuant to IC § 35-38-9-1, "
            f"expungement is mandatory and requires no filing fee.",
            st['body']))
        para_num += 1

    if sect2_cases:
        cause_list = ", ".join(c['caseNumber'] for c in sect2_cases)
        story.append(Paragraph(
            f"<b>{para_num}. Eligibility under IC § 35-38-9-2 (Misdemeanor Convictions):</b> "
            f"For Cause Nos. {cause_list}, more than five (5) years have elapsed since the date of conviction. "
            f"Petitioner has not been convicted of any crime within the statutory period, has no pending charges, "
            f"and has satisfied all court costs and obligations. Expungement is mandatory.",
            st['body']))
        para_num += 1

    if sect3_cases:
        cause_list = ", ".join(c['caseNumber'] for c in sect3_cases)
        story.append(Paragraph(
            f"<b>{para_num}. Eligibility under IC § 35-38-9-3 (Class D Felony Convictions):</b> "
            f"For Cause Nos. {cause_list}, more than eight (8) years have elapsed since conviction. "
            f"Petitioner has not been convicted of any crime in the past eight years, has no pending charges, "
            f"has paid all costs/fines, and none of the offenses involved serious bodily injury, sexual misconduct, "
            f"or official corruption. Expungement is mandatory.",
            st['body']))
        para_num += 1

    story.append(Paragraph(
        f"<b>{para_num}. One-Lifetime Petition Rule (IC § 35-38-9-9(i) &amp; IC § 35-38-9-8(b)(7)):</b> "
        f"Petitioner affirms under penalties of perjury that Petitioner has never previously petitioned for or received an "
        f"expungement of conviction records under this chapter, or if another petition was filed, it was filed within the "
        f"statutory 365-day window under IC § 35-38-9-9(d). Petitioner acknowledges that this filing constitutes Petitioner's "
        f"single lifetime opportunity to expunge conviction records, and affirms that no known conviction records in {county} "
        f"County have been omitted from this filing.",
        st['body']))
    para_num += 1
    story.append(Paragraph(
        f"<b>{para_num}. Filing Fee:</b> The required civil filing fee is tendered herewith "
        f"(or an application to proceed in forma pauperis is submitted).",
        st['body']))

    story.append(Paragraph("<b>IV. PRAYER FOR RELIEF</b>", st['heading']))
    story.append(Paragraph(
        f"<b>WHEREFORE</b>, Petitioner respectfully prays that this Court enter an Order granting this Verified Petition for Expungement; "
        f"directing the Clerk of {county} County Courts, the Indiana State Police Central Repository, the Indiana Bureau of Motor Vehicles, "
        f"and local law enforcement agencies to permanently seal and restrict public access to all records, entries, and dockets; "
        f"directing the Indiana Office of Judicial Administration to remove all public search access on Odyssey / MyCase; "
        f"and restoring Petitioner's full civil rights pursuant to Indiana Code § 35-38-9-10.",
        st['body']))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>VERIFICATION UNDER PENALTIES FOR PERJURY</b>", st['heading']))
    story.append(Paragraph(
        "I affirm, under the penalties for perjury pursuant to Indiana Trial Rule 11 and Indiana Code § 35-38-9-8, "
        "that the representations in the foregoing Verified Petition for Expungement are true and correct to the best "
        "of my knowledge, information, and belief.",
        st['body']))
    story.append(Spacer(1, 15))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>{name_upper}</b>, Petitioner Pro Se<br/>Date: ________________________",
        st['body']))
    return story


def generate_form_5(st, payload):
    """Form 05: Notice of Filing to Prosecuting Attorney."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>NOTICE OF FILING OF VERIFIED PETITION FOR EXPUNGEMENT</b>", st['title']))

    prosecutor_box = [
        [Paragraph("<b>TO:</b>", st['tbl_cell_bold']),
         Paragraph(
             f"<b>Office of the Prosecuting Attorney of {county} County</b><br/>"
             f"{county} County Courthouse<br/>"
             f"[Address], {county}, IN [ZIP]",
             st['tbl_cell'])]
    ]
    t_pros = Table(prosecutor_box, colWidths=[50, 454])
    t_pros.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
    ]))
    story.append(t_pros)
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        f"<b>PLEASE TAKE NOTICE</b> that on ________________________, Petitioner, <b>{name}</b>, filed with the Clerk "
        f"of the {court} a <i>Verified Petition for Expungement of Arrest, Infraction, Misdemeanor, and Felony Records</i> "
        f"pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, and 35-38-9-8.",
        st['body']))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Pursuant to <b>Indiana Code § 35-38-9-8(f) and § 35-38-9-9</b>, a copy of the Verified Petition for Expungement "
        "is served upon you herewith. You are hereby notified that you have <b>thirty (30) days</b> from the date of service "
        "of this notice to file an answer, response, or objection to the Petition.",
        st['body']))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "If no objection is filed within thirty (30) days, the Court may grant the Verified Petition for Expungement "
        "without further hearing pursuant to Indiana Code § 35-38-9-9(b).",
        st['body']))
    story.append(Spacer(1, 20))

    story.append(Paragraph("Respectfully submitted,", st['body']))
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>{name_upper}</b>, Petitioner Pro Se<br/>Date: ________________________",
        st['body']))
    return story


def generate_form_6(st, payload):
    """Form 06: Certificate of Service."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>CERTIFICATE OF SERVICE</b>", st['title']))

    story.append(Paragraph(
        "I hereby certify that on ________________________, a true and accurate copy of the <i>Verified Petition for Expungement</i>, "
        "<i>Notice of Exclusion of Confidential Information</i>, and <i>Notice of Filing</i> was served upon the following parties "
        "in the manner indicated below:",
        st['body']))
    story.append(Spacer(1, 6))

    service_data = [
        [Paragraph("<b>Recipient Agency &amp; Address</b>", st['tbl_header']),
         Paragraph("<b>Method of Service</b>", st['tbl_header'])],
        [Paragraph(
            f"<b>1. Office of the Prosecuting Attorney of {county} County:</b><br/>"
            f"{county} County Courthouse, [Address], {county}, IN [ZIP]",
            st['tbl_cell']),
         Paragraph("[ &nbsp; ] First Class U.S. Mail<br/>[ &nbsp; ] Indiana E-Filing System (IEFS)<br/>[ &nbsp; ] Hand Delivery", st['tbl_cell'])],
        [Paragraph(
            "<b>2. Indiana State Police - Central Records Repository:</b><br/>"
            "Criminal History Records Division, Indiana Government Center North<br/>"
            "100 N. Senate Ave., Suite N302, Indianapolis, IN 46204",
            st['tbl_cell']),
         Paragraph("[ &nbsp; ] Certified U.S. Mail<br/>[ &nbsp; ] First Class U.S. Mail", st['tbl_cell'])],
        [Paragraph(
            "<b>3. Indiana Bureau of Motor Vehicles (BMV):</b><br/>"
            "Legal Department / Records Section, 100 N. Senate Ave., Room N404, Indianapolis, IN 46204",
            st['tbl_cell']),
         Paragraph("[ &nbsp; ] First Class U.S. Mail<br/>[ &nbsp; ] Certified U.S. Mail", st['tbl_cell'])],
        [Paragraph(
            f"<b>4. {county} County Sheriff's Department:</b><br/>"
            f"[Address], {county}, IN [ZIP]",
            st['tbl_cell']),
         Paragraph("[ &nbsp; ] First Class U.S. Mail<br/>[ &nbsp; ] Hand Delivery", st['tbl_cell'])],
    ]
    t_svc = Table(service_data, colWidths=[320, 184])
    t_svc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ]))
    story.append(t_svc)
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>{name_upper}</b>, Petitioner Pro Se<br/>Date: ________________________",
        st['body']))
    return story


def generate_form_7(st, payload):
    """Form 07: Proposed Order Granting Expungement."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    n_cases = len(cases)
    story = []
    story.append(make_court_caption(st, name, county, court, court_code, aliases=pet.get('aliases') or None))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>ORDER GRANTING VERIFIED PETITION FOR EXPUNGEMENT OF ARREST, INFRACTION, MISDEMEANOR, AND FELONY RECORDS</b>",
        st['title']))

    aka_str = f" (a/k/a {pet['aliases']})" if pet.get('aliases') else ""
    story.append(Paragraph(
        f"This matter came before the Court upon the <i>Verified Petition for Expungement</i> "
        f"filed by Petitioner, <b>{name}</b>{aka_str}, pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, and 35-38-9-8. "
        f"The Court, having examined the verified pleadings, court records, and files, and having received no objection "
        f"from the Prosecuting Attorney, now enters the following:",
        st['body']))

    story.append(Paragraph("<b>FINDINGS OF FACT AND CONCLUSIONS OF LAW</b>", st['heading']))
    story.append(Paragraph("1. The Court has personal jurisdiction over Petitioner and subject matter jurisdiction over all underlying cases.", st['body']))
    story.append(Paragraph("2. All statutory waiting periods have been satisfied under IC §§ 35-38-9-1, 35-38-9-2, and 35-38-9-3.", st['body']))
    story.append(Paragraph("3. Petitioner has no criminal charges currently pending in this or any other jurisdiction.", st['body']))
    story.append(Paragraph("4. Petitioner has paid and fully satisfied all court costs, fees, fines, and restitution.", st['body']))
    story.append(Paragraph("5. Petitioner has not been convicted of any crime within the statutory waiting periods.", st['body']))
    story.append(Paragraph("6. Petitioner has not previously petitioned for or received an expungement under Indiana law.", st['body']))
    story.append(Paragraph("7. The offenses do not include any ineligible disqualifying offenses under IC § 35-38-9-3(b) or IC § 35-38-9-5.", st['body']))
    story.append(Paragraph("8. Petitioner has met all statutory requirements, and expungement is <b>mandatory</b>.", st['body']))

    story.append(Paragraph("<b>ORDER OF EXPUNGEMENT AND SEALING</b>", st['heading']))
    story.append(Paragraph(
        f"<b>IT IS THEREFORE ORDERED, ADJUDGED, AND DECREED</b> by the Court that the Verified Petition for Expungement "
        f"is hereby <b>GRANTED</b> as to the following {_num_word(n_cases)} ({n_cases}) matters:",
        st['body']))
    story.append(Spacer(1, 4))
    story.append(build_case_table(st, cases, for_order=True))
    story.append(Spacer(1, 6))

    story.append(Paragraph(f"<b>IT IS FURTHER ORDERED</b> that the Clerk of {county} County Courts shall permanently seal all records.", st['body']))
    story.append(Paragraph("<b>IT IS FURTHER ORDERED</b> that the Indiana State Police Central Records Repository shall seal all arrest records.", st['body']))
    story.append(Paragraph(f"<b>IT IS FURTHER ORDERED</b> that the {county} County Sheriff's Department shall seal all booking files.", st['body']))
    story.append(Paragraph("<b>IT IS FURTHER ORDERED</b> that the Indiana BMV shall seal all related infraction entries.", st['body']))
    story.append(Paragraph("<b>IT IS FURTHER ORDERED</b> that the Indiana Office of Judicial Administration shall remove public search access on MyCase.", st['body']))
    story.append(Paragraph(
        "<b>IT IS FURTHER ORDERED</b> that pursuant to IC § 35-38-9-10, Petitioner's civil rights are fully restored.",
        st['body']))
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>SO ORDERED</b> this ________ day of ________________________, 20____.", st['body']))
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>JUDGE, {court.upper()}</b><br/>{county} County, Indiana",
        st['body']))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        f"<b>Distribution:</b><br/>• {name}, Petitioner Pro Se<br/>"
        f"• Office of the Prosecuting Attorney of {county} County<br/>"
        f"• Indiana State Police - Central Records Repository<br/>"
        f"• Indiana Bureau of Motor Vehicles (BMV)<br/>"
        f"• {county} County Sheriff's Department<br/>"
        f"• Indiana Office of Judicial Administration / Court Technology",
        st['tbl_cell']))
    return story


def generate_form_8(st, payload):
    """Form 08: Fee Waiver Request and Proposed Order."""
    name, name_upper, county, court, court_code, cases, pet, _ = _ctx(payload)
    story = []

    # PAGE 1: VERIFIED MOTION
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>VERIFIED REQUEST TO WAIVE PREPAYMENT OF FILING FEES AND COSTS</b>", st['title']))
    story.append(Paragraph("(PURSUANT TO INDIANA CODE § 33-37-3-2 &amp; INDIANA TRIAL RULES)", st['subtitle']))

    story.append(Paragraph(
        f"Comes now Petitioner, <b>{name}</b>, <i>pro se</i>, and respectfully requests that this Court waive "
        f"the prepayment of court filing fees, administrative costs, and initial case assessment in the above-captioned "
        f"expungement proceeding pursuant to <b>Indiana Code § 33-37-3-2</b>. In support of this verified request, "
        f"Petitioner affirms under penalties of perjury as follows:",
        st['body']))
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>1. Indigency &amp; Financial Hardship:</b>", st['heading']))
    story.append(Paragraph(
        "Petitioner is an indigent person without sufficient income, liquid assets, or property to prepay the required "
        "civil court filing fee (approx. $157.00) without depriving himself and/or his dependents of basic necessities of life.",
        st['body']))

    story.append(Paragraph("<b>2. Public Assistance &amp; Benefits Received:</b>", st['heading']))
    pub_data = [
        [Paragraph("[ &nbsp; ] <b>SNAP / Food Stamps</b>", st['tbl_cell']),
         Paragraph("[ &nbsp; ] <b>Medicaid / Healthy Indiana Plan (HIP)</b>", st['tbl_cell']),
         Paragraph("[ &nbsp; ] <b>SSI / SSDI Disability</b>", st['tbl_cell'])],
        [Paragraph("[ &nbsp; ] <b>TANF / Welfare Assistance</b>", st['tbl_cell']),
         Paragraph("[ &nbsp; ] <b>Unemployment Compensation</b>", st['tbl_cell']),
         Paragraph("[ &nbsp; ] <b>None / Low-Income Wage Earner</b>", st['tbl_cell'])],
    ]
    t_pub = Table(pub_data, colWidths=[168, 172, 164])
    t_pub.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0fff4')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#2f855a')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#c6f6d5')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_pub)
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>3. Monthly Household Income &amp; Living Expenses:</b>", st['heading']))
    inc_data = [
        [Paragraph("<b>MONTHLY INCOME</b>", st['tbl_header']), Paragraph("<b>AMT ($)</b>", st['tbl_header']),
         Paragraph("<b>MONTHLY EXPENSES</b>", st['tbl_header']), Paragraph("<b>AMT ($)</b>", st['tbl_header'])],
        [Paragraph("Gross Wages / Salary:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell']),
         Paragraph("Rent / Mortgage:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell'])],
        [Paragraph("Unemployment Benefits:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell']),
         Paragraph("Utilities:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell'])],
        [Paragraph("SSI / Disability:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell']),
         Paragraph("Food / Groceries:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell'])],
        [Paragraph("Other Income:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell']),
         Paragraph("Transportation:", st['tbl_cell']), Paragraph("$ _____________", st['tbl_cell'])],
        [Paragraph("<b>TOTAL:</b>", st['tbl_cell_bold']), Paragraph("<b>$ _____________</b>", st['tbl_cell_bold']),
         Paragraph("<b>TOTAL:</b>", st['tbl_cell_bold']), Paragraph("<b>$ _____________</b>", st['tbl_cell_bold'])],
    ]
    t_inc = Table(inc_data, colWidths=[160, 92, 160, 92])
    t_inc.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BG),
    ]))
    story.append(t_inc)
    story.append(Spacer(1, 4))

    story.append(Paragraph("<b>AFFIRMATION UNDER PENALTIES FOR PERJURY</b>", st['heading']))
    story.append(Paragraph(
        "I affirm, under the penalties for perjury pursuant to Ind. Trial Rule 11 and IC § 33-37-3-2, "
        "that the foregoing financial representations and statement of indigency are true and accurate.",
        st['body']))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>{name_upper}</b>, Petitioner Pro Se<br/>"
        f"Date: ________________________",
        st['body']))

    # PAGE 2: PROPOSED ORDER
    story.append(PageBreak())
    story.append(make_court_caption(st, name, county, court, court_code))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>ORDER ON REQUEST TO WAIVE PREPAYMENT OF FILING FEES AND COSTS</b>", st['title']))

    story.append(Paragraph(
        f"The Court, having reviewed the <i>Verified Request to Waive Prepayment of Filing Fees and Costs</i> "
        f"and Financial Declaration filed by Petitioner, <b>{name}</b>, pursuant to Indiana Code § 33-37-3-2, "
        f"and being duly advised in the premises, now finds:",
        st['body']))
    story.append(Spacer(1, 6))
    story.append(Paragraph("1. Petitioner is an indigent person unable to pay the required court filing fees without substantial financial hardship.", st['body']))
    story.append(Paragraph("2. Petitioner has established sufficient grounds under IC § 33-37-3-2 to proceed without prepayment.", st['body']))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>IT IS THEREFORE ORDERED BY THE COURT:</b>", st['heading']))
    story.append(Paragraph("1. The <i>Verified Request to Waive Prepayment of Filing Fees</i> is hereby <b>GRANTED</b>.", st['body']))
    story.append(Paragraph(
        f"2. Petitioner, {name}, is permitted to file and proceed with his <i>Verified Petition for Expungement</i> "
        f"without the prepayment of court filing fees.",
        st['body']))
    story.append(Paragraph(
        f"3. The Clerk of the {county} County Courts is directed to file and docket Petitioner's Expungement Petition "
        f"without demanding prepayment of any filing fee.",
        st['body']))
    story.append(Spacer(1, 20))

    story.append(Paragraph("<b>SO ORDERED</b> this ________ day of ________________________, 20____.", st['body']))
    story.append(Spacer(1, 25))
    story.append(Paragraph(
        f"____________________________________________________________<br/><b>JUDGE, {court.upper()}</b><br/>{county} County, Indiana",
        st['body']))
    return story


# ─── Utilities ──────────────────────────────────────────────────────────

def _num_word(n):
    """Convert small integers to English words for legal documents."""
    words = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
             6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
             11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen',
             15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen',
             19: 'nineteen', 20: 'twenty'}
    return words.get(n, str(n))


# ─── Master Generation Entry Point ─────────────────────────────────────

def generate_packet(payload: dict) -> io.BytesIO:
    """
    Generate a complete expungement petition packet as a ZIP file in memory.

    Args:
        payload: Dict with keys:
            - petitioner: { fullName, dob, ssn, driverLicense, currentAddress, phone, email, addresses[] }
            - county: str
            - court: str
            - courtCode: str
            - cases: [{ caseNumber, type, statute, charges, filed, dispositionDate, court, grantType }]
            - includeFeeWaiver: bool
            - includeAddressSupplement: bool

    Returns:
        io.BytesIO containing the ZIP archive
    """
    st = get_pdf_styles()
    pet = payload.get('petitioner', {})
    name = pet.get('fullName', 'PETITIONER')
    court_name = payload.get('court', 'Unknown Court')

    forms = [
        ("00_CRITICAL_WARNING_AND_INSTRUCTIONS.pdf", generate_form_0(st, payload)),
        ("01_Appearance_Form.pdf", generate_form_1(st, payload)),
        ("02_Notice_of_Exclusion_Confidential_Info.pdf", generate_form_2(st, payload)),
        ("03_Confidential_Information_Sheet.pdf", generate_form_3(st, payload)),
        ("04_Verified_Petition_for_Expungement.pdf", generate_form_4(st, payload)),
        ("05_Notice_of_Filing_to_Prosecutor.pdf", generate_form_5(st, payload)),
        ("06_Certificate_of_Service.pdf", generate_form_6(st, payload)),
        ("07_Proposed_Order_Granting_Expungement.pdf", generate_form_7(st, payload)),
    ]

    if payload.get('includeFeeWaiver', False):
        forms.append(("08_Fee_Waiver_Request_and_Order.pdf", generate_form_8(st, payload)))

    # Build individual PDFs
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for filename, story in forms:
            pdf_buffer = io.BytesIO()

            def make_canvas_factory(pet_name, crt_name):
                def canvas_factory(fn, pagesize=letter, **kwargs):
                    return NumberedCanvas(fn, pagesize,
                                         petitioner_name=pet_name,
                                         court_name=crt_name)
                return canvas_factory

            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=letter,
                leftMargin=54, rightMargin=54,
                topMargin=54, bottomMargin=54
            )
            doc.build(story, canvasmaker=make_canvas_factory(name, court_name))
            zipf.writestr(filename, pdf_buffer.getvalue())

        # Master Combined Packet (regenerate stories to provide fresh flowables)
        master_buffer = io.BytesIO()
        master_story = []
        generators = [
            generate_form_0,
            generate_form_1,
            generate_form_2,
            generate_form_3,
            generate_form_4,
            generate_form_5,
            generate_form_6,
            generate_form_7,
        ]
        if payload.get('includeFeeWaiver', False):
            generators.append(generate_form_8)

        for gen in generators:
            if master_story:
                master_story.append(PageBreak())
            master_story.extend(gen(st, payload))

        master_doc = SimpleDocTemplate(
            master_buffer,
            pagesize=letter,
            leftMargin=54, rightMargin=54,
            topMargin=54, bottomMargin=54
        )
        master_doc.build(master_story, canvasmaker=make_canvas_factory(name, court_name))
        zipf.writestr("00_COMPLETE_EXPUNGEMENT_PETITION_PACKET.pdf", master_buffer.getvalue())


    zip_buffer.seek(0)
    return zip_buffer
