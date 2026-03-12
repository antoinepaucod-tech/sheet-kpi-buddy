"""PDF Report route"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
from io import BytesIO

from core.config import db, MONTHS_FR
from models.kpi import compute_metrics

router = APIRouter(tags=["reports"])


@router.get("/report/pdf/{month}")
async def generate_pdf_report(month: str):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT

    kpi = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    kpi = compute_metrics(kpi)

    settings = await db.club_settings.find_one({"id": "default"}, {"_id": 0})
    club_name = settings.get("club_name", "Mon Club") if settings else "Mon Club"

    year, m = month.split("-")
    month_name = MONTHS_FR[int(m) - 1]

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, alignment=TA_CENTER, spaceAfter=10, textColor=HexColor('#E11D48'))
    subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Normal'], fontSize=14, alignment=TA_CENTER, spaceAfter=20, textColor=HexColor('#666666'))
    section_style = ParagraphStyle('SectionTitle', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15, textColor=HexColor('#333333'))

    elements = []
    elements.append(Paragraph(club_name, title_style))
    elements.append(Paragraph(f"Rapport Mensuel - {month_name} {year}", subtitle_style))

    def fmt_chf(v):
        return f"{v:,.2f} CHF".replace(",", "'")

    elements.append(Paragraph("Résumé des KPIs", section_style))
    kpi_data = [
        ["Indicateur", "Valeur"],
        ["Revenus Totaux", fmt_chf(kpi.get("total_revenue", 0))],
        ["Bénéfice Net", fmt_chf(kpi.get("net_profit", 0))],
        ["Dépenses Totales", fmt_chf(kpi.get("total_expenses", 0))],
        ["Marge Nette", f"{kpi.get('profit_margin', 0):.1f}%"],
        ["Membres Actifs", str(kpi.get("total_members", 0))],
        ["Nouveaux Membres", str(kpi.get("new_members", 0))],
        ["Membres Perdus", str(kpi.get("lost_members", 0))],
        ["Taux de Churn", f"{kpi.get('churn_rate', 0):.2f}%"],
        ["CAC", fmt_chf(kpi.get("cac", 0))],
        ["ROAS", f"{kpi.get('roas', 0):.1f}x"],
    ]

    kpi_table = Table(kpi_data, colWidths=[100*mm, 60*mm])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#E11D48')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#F8F8F8')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#DDDDDD')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(kpi_table)

    elements.append(Spacer(1, 15*mm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=HexColor('#999999'))
    elements.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} - Sheet KPI Buddy", footer_style))

    doc.build(elements)
    buffer.seek(0)

    filename = f"rapport_{club_name.replace(' ', '_')}_{month}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})
