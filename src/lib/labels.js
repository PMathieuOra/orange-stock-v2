import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Formats d'étiquettes disponibles
export const LABEL_FORMATS = {
  large: { id: 'large', label: '1 par page (A4)', perPage: 1, rows: 1, cols: 1, w: 190, h: 270 },
  medium: { id: 'medium', label: '8 par page (A4)', perPage: 8, rows: 4, cols: 2, w: 95, h: 67 },
  small: { id: 'small', label: '21 par page (A4 - format Avery)', perPage: 21, rows: 7, cols: 3, w: 63, h: 38 },
};

// Génère un PDF d'étiquettes pour une liste de tourets
// tourets = [{ ref_touret, initiale, restante, nom_cable, categorie, ref_type, emplacement, magasin, service }, ...]
export async function generateTouretLabels(tourets, options = {}) {
  const { format = 'medium', title = null } = options;
  const fmt = LABEL_FORMATS[format] || LABEL_FORMATS.medium;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;

  // Marges pour centrer les étiquettes sur la page
  const totalW = fmt.cols * fmt.w;
  const totalH = fmt.rows * fmt.h;
  const marginX = (pageW - totalW) / 2;
  const marginY = (pageH - totalH) / 2;

  // Pré-générer les QR codes
  const qrPromises = tourets.map((t) =>
    QRCode.toDataURL(
      JSON.stringify({
        ref: t.ref_touret,
        cable: t.nom_cable,
        initiale: t.initiale,
      }),
      { width: 200, margin: 1 }
    )
  );
  const qrCodes = await Promise.all(qrPromises);

  for (let i = 0; i < tourets.length; i++) {
    const t = tourets[i];
    const qr = qrCodes[i];

    const idxInPage = i % fmt.perPage;
    if (idxInPage === 0 && i > 0) {
      doc.addPage();
    }

    const row = Math.floor(idxInPage / fmt.cols);
    const col = idxInPage % fmt.cols;

    const x = marginX + col * fmt.w;
    const y = marginY + row * fmt.h;

    drawLabel(doc, t, qr, x, y, fmt.w, fmt.h, fmt.id);
  }

  // Métadonnées
  doc.setProperties({
    title: title || `Étiquettes tourets (${tourets.length})`,
    creator: 'Orange Stock V2',
  });

  return doc;
}

// Dessine une étiquette individuelle
function drawLabel(doc, t, qr, x, y, w, h, format) {
  const padding = format === 'small' ? 2 : 3;
  const fontMain = format === 'small' ? 7 : format === 'medium' ? 10 : 14;
  const fontTitle = format === 'small' ? 9 : format === 'medium' ? 14 : 22;
  const fontMini = format === 'small' ? 6 : 8;
  const qrSize = Math.min(h - padding * 2, format === 'small' ? 24 : format === 'medium' ? 40 : 60);

  // Cadre
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  // Bandeau de couleur en haut selon la catégorie
  const catColor = t.categorie === 'fibre' ? [0, 168, 107] : t.categorie === 'cuivre' ? [217, 119, 6] : [200, 200, 200];
  doc.setFillColor(...catColor);
  doc.rect(x, y, w, format === 'small' ? 3 : 5, 'F');

  // Zone QR à droite
  const qrX = x + w - qrSize - padding;
  const qrY = y + (h - qrSize) / 2;
  doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);

  // Zone texte à gauche
  const textX = x + padding;
  const textMaxW = qrX - textX - 2;
  let textY = y + (format === 'small' ? 6 : 9);

  // Ref touret (gros)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontTitle);
  doc.setTextColor(0, 0, 0);
  doc.text(t.ref_touret || '—', textX, textY, { maxWidth: textMaxW });
  textY += fontTitle * 0.45;

  // Nom du câble
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontMain);
  doc.setTextColor(40, 40, 40);
  const nomCable = (t.nom_cable || '').slice(0, format === 'small' ? 18 : 24);
  doc.text(nomCable, textX, textY, { maxWidth: textMaxW });
  textY += fontMain * 0.5;

  // Catégorie + ref_type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontMini);
  doc.setTextColor(...catColor);
  doc.text((t.categorie || '').toUpperCase(), textX, textY, { maxWidth: textMaxW });
  textY += fontMini * 0.5;

  if (t.ref_type) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`EAN: ${t.ref_type}`, textX, textY, { maxWidth: textMaxW });
    textY += fontMini * 0.5;
  }

  // Longueur initiale (en bas, en gros)
  if (h - (textY - y) > fontMain) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontMain);
    doc.setTextColor(0, 0, 0);
    doc.text(`📏 ${t.initiale || '?'} m`, textX, y + h - padding - 1, { maxWidth: textMaxW });
  }

  // Emplacement et magasin (tout en bas)
  if (t.emplacement || t.magasin) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(fontMini);
    doc.setTextColor(100, 100, 100);
    const meta = [t.magasin, t.emplacement].filter(Boolean).join(' · ');
    doc.text(meta.slice(0, 30), textX, y + h - padding - 1 - fontMain * 0.45, { maxWidth: textMaxW });
  }
}

// Imprime / télécharge le PDF
export function downloadPdf(doc, filename = 'etiquettes-tourets.pdf') {
  doc.save(filename);
}
