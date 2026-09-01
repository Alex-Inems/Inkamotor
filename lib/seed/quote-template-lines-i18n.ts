import type { SaleLine } from "@/lib/demo-data";
import type { Locale } from "@/lib/i18n";

/** Localized boilerplate lines (template id → locale). French lives in odoo-quote-templates.json. */
export const QUOTE_TEMPLATE_LINES_I18N: Record<
  number,
  Partial<Record<Locale, SaleLine[]>>
> = {
  1: {
    en: [
      {
        description: "Services included",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "> Kawasaki KLR650cc motorcycle with top case and tank bag\n> Taxi transfers airport–hotel (round trip)\n> Taxi transfers hotel–motorcycles (round trip)\n> Motorcycle guide who holds your package and briefs you on site the day before departure\n> GoPro recording\n> Accommodation 14 nights in standard/comfort double room – breakfasts included\n> Personal bodily accident insurance covering Peru (repatriation excluded)\n> Support vehicle with driver (or similar model)",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Not included",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "Tourist site entries (Machu Picchu, Nazca lines, etc.)\nFood\nInternational flight ticket\nFuel",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Please note",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Each trip can be adapted, shortened, extended or modified.",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
    ],
    es: [
      {
        description: "Servicios incluidos",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "> Moto Kawasaki KLR650cc equipada con topcase y bolsa de depósito\n> Transfers en taxi aeropuerto–hotel (ida y vuelta)\n> Transfers en taxi hotel–motos (ida y vuelta)\n> Guía motero que gestiona su paquete y le informa en el lugar la víspera de la salida\n> Grabación GoPro\n> Alojamiento 14 noches en habitación doble estándar/confort – desayunos incluidos\n> Seguro de accidentes corporales personalizado con cobertura en Perú (repatriación excluida)\n> Vehículo de asistencia con conductor (o modelo similar)",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "No incluido",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "Entradas a lugares turísticos (Machu Picchu, líneas de Nazca, etc.)\nComida\nBillete de avión internacional\nGasolina",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "A tener en cuenta",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Cada viaje puede adaptarse, acortarse, alargarse o modificarse.",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
    ],
  },
  2: {
    en: [
      {
        description: "Services included",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "> Motorcycle with top case and tank bag\n> Taxi transfers airport–hotel (round trip)\n> Experienced motorcycle guide\n> Accommodation in double room – breakfasts included\n> Bodily accident insurance covering Peru (repatriation excluded)\n> 4x4 support vehicle with driver",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Not included",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "Tourist site entries\nFood\nInternational flight ticket\nFuel",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Please note",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Each trip can be adapted, shortened, extended or modified.",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
    ],
    es: [
      {
        description: "Servicios incluidos",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "> Moto equipada con topcase y bolsa de depósito\n> Transfers en taxi aeropuerto–hotel (ida y vuelta)\n> Guía motero experimentado\n> Alojamiento en habitación doble – desayunos incluidos\n> Seguro de accidentes corporales con cobertura en Perú (repatriación excluida)\n> Vehículo 4x4 de asistencia con conductor",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "No incluido",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description:
          "Entradas a lugares turísticos\nComida\nBillete de avión internacional\nGasolina",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "A tener en cuenta",
        displayType: "section",
        qty: 0,
        unitPrice: 0,
      },
      {
        description: "Cada viaje puede adaptarse, acortarse, alargarse o modificarse.",
        displayType: "note",
        qty: 0,
        unitPrice: 0,
      },
    ],
  },
};
