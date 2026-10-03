"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import type { Map as MapLibreMapType, Marker as MarkerType, Popup as PopupType } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { COUNTRY_CENTROIDS } from "@/lib/ads/country-centroids";
import { useLocale } from "@/lib/i18n";

// Turbopack does not rewrite MapLibre v6's worker sibling import — serve from /public.
setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

export type MapPlace = { code: string; clicks: number };

/** GSC uses ISO-3166-1 alpha-3; centroids use alpha-2. */
const ISO3_TO_ISO2: Record<string, string> = {
  afg: "af", alb: "al", dza: "dz", and: "ad", ago: "ao", arg: "ar", arm: "am",
  aus: "au", aut: "at", aze: "az", bhs: "bs", bhr: "bh", bgd: "bd", brb: "bb",
  blr: "by", bel: "be", blz: "bz", ben: "bj", btn: "bt", bol: "bo", bih: "ba",
  bwa: "bw", bra: "br", brn: "bn", bgr: "bg", bfa: "bf", bdi: "bi", khm: "kh",
  cmr: "cm", can: "ca", cpv: "cv", caf: "cf", tcd: "td", chl: "cl", chn: "cn",
  col: "co", com: "km", cog: "cg", cod: "cd", cri: "cr", civ: "ci", hrv: "hr",
  cub: "cu", cyp: "cy", cze: "cz", dnk: "dk", dji: "dj", dma: "dm", dom: "do",
  ecu: "ec", egy: "eg", slv: "sv", gnq: "gq", eri: "er", est: "ee", swz: "sz",
  eth: "et", fji: "fj", fin: "fi", fra: "fr", gab: "ga", gmb: "gm", geo: "ge",
  deu: "de", gha: "gh", grc: "gr", grd: "gd", gtm: "gt", gin: "gn", gnb: "gw",
  guy: "gy", hti: "ht", hnd: "hn", hkg: "hk", hun: "hu", isl: "is", ind: "in",
  idn: "id", irn: "ir", irq: "iq", irl: "ie", isr: "il", ita: "it", jam: "jm",
  jpn: "jp", jor: "jo", kaz: "kz", ken: "ke", kwt: "kw", kgz: "kg", lao: "la",
  lva: "lv", lbn: "lb", lso: "ls", lbr: "lr", lby: "ly", lie: "li", ltu: "lt",
  lux: "lu", mac: "mo", mdg: "mg", mwi: "mw", mys: "my", mdv: "mv", mli: "ml",
  mlt: "mt", mrt: "mr", mus: "mu", mex: "mx", mda: "md", mco: "mc", mng: "mn",
  mne: "me", mar: "ma", moz: "mz", mmr: "mm", nam: "na", npl: "np", nld: "nl",
  nzl: "nz", nic: "ni", ner: "ne", nga: "ng", mkd: "mk", nor: "no", omn: "om",
  pak: "pk", pan: "pa", png: "pg", pry: "py", per: "pe", phl: "ph", pol: "pl",
  prt: "pt", pri: "pr", qat: "qa", rou: "ro", rus: "ru", rwa: "rw", sau: "sa",
  sen: "sn", srb: "rs", syc: "sc", sle: "sl", sgp: "sg", svk: "sk", svn: "si",
  slb: "sb", som: "so", zaf: "za", ssd: "ss", esp: "es", lka: "lk", sdn: "sd",
  sur: "sr", swe: "se", che: "ch", syr: "sy", twn: "tw", tjk: "tj", tza: "tz",
  tha: "th", tls: "tl", tgo: "tg", tto: "tt", tun: "tn", tur: "tr", tkm: "tm",
  uga: "ug", ukr: "ua", are: "ae", gbr: "gb", usa: "us", ury: "uy", uzb: "uz",
  vut: "vu", ven: "ve", vnm: "vn", yem: "ye", zmb: "zm", zwe: "zw", xkk: "xk",
};

function countryIso2(code: string) {
  const key = code.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(key)) return key;
  return ISO3_TO_ISO2[key] ?? "";
}

function countryLabel(code: string, locale: string) {
  const iso2 = countryIso2(code);
  if (!iso2) return code.trim().toUpperCase() || "—";
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(iso2.toUpperCase()) ||
      iso2.toUpperCase()
    );
  } catch {
    return iso2.toUpperCase();
  }
}

function flagUrl(iso2: string) {
  return `https://flagcdn.com/w40/${iso2}.png`;
}

type PlacePin = MapPlace & { lat: number; lng: number; iso2: string; label: string };

export function CountryMap({
  places,
  focused,
  onFocus,
  locale,
  formatClicks,
}: {
  places: MapPlace[];
  focused: string | null;
  onFocus: (code: string) => void;
  locale: string;
  formatClicks: (n: number) => string;
}) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMapType | null>(null);
  const markersRef = useRef<Map<string, MarkerType>>(new Map());
  const popupRef = useRef<PopupType | null>(null);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  const pins = useMemo(() => {
    const rows: PlacePin[] = [];
    for (const place of places) {
      const iso2 = countryIso2(place.code);
      const point = iso2 ? COUNTRY_CENTROIDS[iso2] : null;
      if (!iso2 || !point) continue;
      rows.push({
        ...place,
        iso2,
        lat: point.lat,
        lng: point.lng,
        label: countryLabel(place.code, locale),
      });
    }
    return rows;
  }, [places, locale]);

  const pinsKey = pins.map((p) => `${p.code}:${p.clicks}`).join("|");

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [8, 22],
      zoom: 1.35,
      pitch: 48,
      bearing: -12,
      maxPitch: 70,
      attributionControl: { compact: true },
    });

    map.addControl(
      new NavigationControl({
        visualizePitch: true,
        showCompass: true,
      }),
      "top-right",
    );
    map.addControl(new ScaleControl({ maxWidth: 100 }), "bottom-left");

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const formatRef = useRef(formatClicks);
  formatRef.current = formatClicks;

  // Sync markers with places
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyMarkers = () => {
      const keep = new Set(pins.map((p) => p.code));
      for (const [code, marker] of markersRef.current) {
        if (!keep.has(code)) {
          marker.remove();
          markersRef.current.delete(code);
        }
      }

      const maxClicks = Math.max(...pins.map((p) => p.clicks), 1);

      for (const pin of pins) {
        let marker = markersRef.current.get(pin.code);
        if (!marker) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "gsc-map-marker";
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onFocusRef.current(pin.code);
          });
          marker = new Marker({ element: el, anchor: "center" })
            .setLngLat([pin.lng, pin.lat])
            .addTo(map);
          markersRef.current.set(pin.code, marker);
        }

        const el = marker.getElement();
        const weight = Math.sqrt(pin.clicks / maxClicks);
        const size = Math.round(14 + weight * 16);
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.dataset.active = focused && pin.code === focused ? "1" : "0";
        el.title = `${pin.label} · ${formatRef.current(pin.clicks)}`;
        el.setAttribute("aria-label", pin.label);
        marker.setLngLat([pin.lng, pin.lat]);
      }
    };

    if (map.isStyleLoaded()) applyMarkers();
    else map.once("load", applyMarkers);
  }, [pinsKey, focused, pins]);

  // Fly to focused place + popup
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pins.length) return;

    const pin = pins.find((p) => p.code === focused) ?? pins[0]!;
    if (!pin) return;

    for (const [code, marker] of markersRef.current) {
      marker.getElement().dataset.active = code === pin.code ? "1" : "0";
    }

    const html = `
      <div class="gsc-map-popup">
        <img src="${flagUrl(pin.iso2)}" width="20" height="14" alt="" />
        <div>
          <strong>${escapeHtml(pin.label)}</strong>
          <span>${escapeHtml(formatRef.current(pin.clicks))}</span>
        </div>
      </div>
    `;

    if (!popupRef.current) {
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        className: "gsc-maplibre-popup",
      });
    }
    popupRef.current.setLngLat([pin.lng, pin.lat]).setHTML(html).addTo(map);

    map.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(map.getZoom() < 2.5 ? 4.2 : map.getZoom(), 4.2),
      pitch: 56,
      bearing: map.getBearing(),
      essential: true,
      duration: 1100,
    });
  }, [focused, pins]);

  return (
    <div className="gsc-map-shell mt-4 overflow-hidden rounded-2xl sm:mt-5">
      <div
        ref={containerRef}
        className="gsc-maplibre h-56 w-full sm:h-72"
        role="region"
        aria-label={t("pages.searchConsole.mapPinHint")}
      />
      <p className="border-t border-line/70 bg-panel/80 px-3 py-2 text-[11px] text-mute">
        {t("pages.searchConsole.map3dHint")}
      </p>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
