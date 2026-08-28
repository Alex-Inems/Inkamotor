import templates from "@/lib/seed/odoo-quote-templates.json";
import type { Sale, SaleLine } from "@/lib/demo-data";

export type OdooQuoteTemplate = {
  id: number;
  name: string;
  numberOfDays: number;
  requireSignature: boolean;
  requirePayment: boolean;
  noteHtml: string;
};

const list = templates as OdooQuoteTemplate[];

export const DEFAULT_QUOTE_TEMPLATE = list[0]!;

export function getQuoteTemplate(id: number) {
  return list.find((t) => t.id === id) ?? null;
}

export function getQuoteTemplateByName(name: string) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return list.find((t) => t.name.trim().toLowerCase() === key) ?? null;
}

/** Odoo S00171 — exact lines + template from live Odoo (Aug 2026). */
export const SALE_S00171_LINES: SaleLine[] = [
  {
    description: "Voyage du 12 juin au 02 juillet 2027",
    displayType: "section",
    qty: 0,
    unitPrice: 0,
  },
  {
    description: "Pack personnalisé location Royal Enfield Himalayan 450",
    displayType: "product",
    qty: 1,
    unitPrice: 8883,
  },
  {
    description: "Services inclus",
    displayType: "section",
    qty: 0,
    unitPrice: 0,
  },
  {
    description:
      "> Moto Royal Enfield HIMALAYAN 450 équipée avec topcase et sacoche de réservoir\n> Transports taxi aéroport hôtel (aller/retour)\n> Transports taxi hôtel jusqu'aux motos (aller/retour)\n> Pack touristique\n- Lima : Musée Larco, Musée et couvent de San Francisco (avec ses catacombes) + transports + guide\n- Puno : Visite des îles flottantes des Uros et de l'île de Taquile - nourriture, bateau, guide et transport depuis l'hôtel\n- Cusco : Montagne aux 7 couleurs de Palcoyo\n- Cusco : Journée au Machu Picchu - entrée du site, bus aller-retour Aguas Calientes/site, train aller-retour, guide\n- Cusco : Journée dans la Vallée Sacrée - tous les sites inclus + guide\n- Nasca : Planétarium, visite guidée du site cérémoniel de Cahuachi et survol des lignes de Nasca\n- Ica : Visite du domaine viticole de Tacama (vignes et dégustation de vins) + transport + buggy dans le désert de Huacachina\n- Paracas : Visite des îles Ballestas et de la réserve nationale de Paracas + guide\n\n> Support whatsapp - réponse dans les 24h\n> Logement 21 nuits en chambre double standard/confort – petits déjeuners inclus\n> Assurance accident corporel personnalisé couverture Pérou (excepté rapatriement)\n> Véhicule 4X4 MAZDA BT50 avec chauffeur (ou modèle similaire)\n> Véhicule 4X4 MAZDA BT50 sans chauffeur (ou modèle similaire)",
    displayType: "note",
    qty: 0,
    unitPrice: 0,
  },
  {
    description: "Non-inclus",
    displayType: "section",
    qty: 0,
    unitPrice: 0,
  },
  {
    description: "Nourriture\nBillet d'avion international\nEssence",
    displayType: "note",
    qty: 0,
    unitPrice: 0,
  },
];

export function enrichSale(sale: Sale): Sale {
  if (sale.number === "S00171" && sale.lines.length === 0) {
    return {
      ...sale,
      currency: "EUR",
      quoteTemplateName: DEFAULT_QUOTE_TEMPLATE.name,
      paymentTerms: "30% maintenant, le solde à 60 jours",
      validityDate: sale.validityDate ?? "2026-08-30",
      termsHtml: DEFAULT_QUOTE_TEMPLATE.noteHtml,
      salesperson: sale.salesperson || "Jorge Inkamoto",
      product: "Pack personnalisé location Royal Enfield Himalayan 450",
      amount: 8883,
      lines: SALE_S00171_LINES,
    };
  }

  let next = sale;
  if (!next.termsHtml) {
    const tpl =
      getQuoteTemplateByName(next.quoteTemplateName) ?? DEFAULT_QUOTE_TEMPLATE;
    next = {
      ...next,
      termsHtml: tpl.noteHtml,
      quoteTemplateName: next.quoteTemplateName || tpl.name,
    };
  }

  if (next.lines.length === 0 && next.product) {
    next = {
      ...next,
      lines: [
        {
          description: next.product,
          displayType: "product",
          qty: 1,
          unitPrice: next.amount,
        },
      ],
    };
  }

  return next;
}

export function saleTotal(sale: Sale) {
  return sale.lines.reduce((sum, line) => {
    if (line.displayType !== "product") return sum;
    return sum + line.qty * line.unitPrice;
  }, 0);
}

export function saleBillableLines(sale: Sale) {
  return sale.lines.filter((line) => line.displayType === "product");
}

export function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
