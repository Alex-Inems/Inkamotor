import test from "node:test";
import assert from "node:assert/strict";
import {
  detectClientLanguage,
  detectTextLanguage,
} from "../client-language";

test("detectTextLanguage identifies French text", () => {
  const text =
    "Bonjour François, Merci pour votre message et ravie de vous retrouver après notre rencontre à Barcelonnette. Vous trouverez en pièce jointe le roadbook du circuit moto.";
  const res = detectTextLanguage(text);
  assert.equal(res.language, "fr");
  assert.equal(res.confidence, "high");
});

test("detectTextLanguage identifies Spanish text", () => {
  const text =
    "Hola Carlos, muchas gracias por su consulta sobre el viaje en moto por Perú. Le enviamos la cotización y los detalles del alojamiento.";
  const res = detectTextLanguage(text);
  assert.equal(res.language, "es");
  assert.equal(res.confidence, "high");
});

test("detectTextLanguage identifies English text", () => {
  const text =
    "Hello John, thank you for reaching out regarding our motorcycle tours in South America. Please find our itinerary and booking details attached.";
  const res = detectTextLanguage(text);
  assert.equal(res.language, "en");
  assert.equal(res.confidence, "high");
});

test("detectClientLanguage prioritizes message content over country or phone", () => {
  const lead = {
    name: "Alex",
    email: "alex@example.com",
    phone: "+15551234567",
    notes: "Pays: Spain",
  };
  const res = detectClientLanguage(lead, {
    messagesText: "Bonjour Sophie, merci pour l'information sur le départ de novembre.",
  });
  assert.equal(res.language, "fr");
  assert.equal(res.confidence, "high");
});

test("detectClientLanguage detects French from phone and notes", () => {
  const lead = {
    name: "Daniel DUPONT",
    email: "daniel@gmail.com",
    phone: "0033767822524",
    notes: "Eu au téléphone le 29 septembre; Reviendra vers nous",
  };
  const res = detectClientLanguage(lead);
  assert.equal(res.language, "fr");
});

test("detectClientLanguage detects Spanish from country and phone", () => {
  const lead = {
    name: "Mateo Gomez",
    email: "mateo@gmail.com",
    phone: "+34 612 345 678",
    notes: "Pays: Espagne",
  };
  const res = detectClientLanguage(lead);
  assert.equal(res.language, "es");
});

test("detectClientLanguage detects English from country and domain", () => {
  const lead = {
    name: "James Wilson",
    email: "james@wilson.co.uk",
    phone: "+44 7911 123456",
    notes: "Interested in Cusco tour for 2027",
  };
  const res = detectClientLanguage(lead);
  assert.equal(res.language, "en");
});
