"use client";

import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  InfrastructureSystem,
  SystemType,
  statusColor,
  systemTypeLabels,
} from "@/lib/infrastructure";
import { toCanonicalSystemId } from "@/lib/archestra";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MapViewProps {
  systems: InfrastructureSystem[];
  selectedSystemId: string | null;
  resolvedSystemId?: string;
  resolvingSystemId?: string;
  onSelectSystem: (systemId: string) => void;
  onDeselectSystem: () => void;
}

type CesiumModule = typeof import("cesium");

// ---------------------------------------------------------------------------
// Infrastructure connection topology (which systems are linked)
// ---------------------------------------------------------------------------
const TOPOLOGY_LINKS: [string, string][] = [
  ["grid_001", "substation_001"],
  ["grid_002", "substation_001"],
  ["grid_001", "data_center_001"],
  ["hydro_001", "grid_002"],
  ["sewage_001", "data_center_001"],
  ["substation_001", "data_center_001"],
];

// ---------------------------------------------------------------------------
// Marker SVG Builder — distinctive per system type + status color
// ---------------------------------------------------------------------------
function buildMarkerSvg(
  systemType: SystemType,
  color: string,
  isSelected: boolean,
  isCritical: boolean,
  isResolving: boolean,
  isResolved: boolean,
): string {
  const size = isSelected ? 64 : 50;
  const cx = size / 2;
  const cy = size / 2;
  const r = isSelected ? 16 : 13;

  let inner = "";
  switch (systemType) {
    case "power_grid": {
      const d = isSelected ? 1.2 : 1;
      inner = `<polygon points="${cx - 3 * d},${cy - 8 * d} ${cx + 2 * d},${cy - 1 * d} ${cx - 1 * d},${cy - 1 * d} ${cx + 3 * d},${cy + 8 * d} ${cx - 2 * d},${cy + 1 * d} ${cx + 1 * d},${cy + 1 * d}" fill="white" opacity="0.95"/>`;
      break;
    }
    case "hydro_plant":
      inner = `<path d="M${cx},${cy - 7} Q${cx + 6},${cy + 2} ${cx},${cy + 7} Q${cx - 6},${cy + 2} ${cx},${cy - 7}Z" fill="white" opacity="0.95"/>`;
      break;
    case "data_center":
      inner = `<rect x="${cx - 5}" y="${cy - 6}" width="10" height="3.5" rx="1" fill="white" opacity="0.95"/><rect x="${cx - 5}" y="${cy - 1.5}" width="10" height="3.5" rx="1" fill="white" opacity="0.8"/><rect x="${cx - 5}" y="${cy + 3}" width="10" height="3.5" rx="1" fill="white" opacity="0.65"/>`;
      break;
    case "substation": {
      const hr = 7;
      const hexPts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${(cx + hr * Math.cos(a)).toFixed(1)},${(cy + hr * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      inner = `<polygon points="${hexPts}" fill="none" stroke="white" stroke-width="1.8" opacity="0.9"/>`;
      break;
    }
    case "solar_farm": {
      let rays = "";
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        const x1 = (cx + 5.5 * Math.cos(a)).toFixed(1);
        const y1 = (cy + 5.5 * Math.sin(a)).toFixed(1);
        const x2 = (cx + 8 * Math.cos(a)).toFixed(1);
        const y2 = (cy + 8 * Math.sin(a)).toFixed(1);
        rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="1.3" opacity="0.8"/>`;
      }
      inner = `<circle cx="${cx}" cy="${cy}" r="3.5" fill="white" opacity="0.95"/>${rays}`;
      break;
    }
    case "sewage_plant":
      inner = `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="white" stroke-width="1.8" opacity="0.9"/><circle cx="${cx}" cy="${cy}" r="2" fill="white" opacity="0.95"/>`;
      break;
  }

  // Resolving spinner ring
  const resolvingRing = isResolving
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="#00bbff" stroke-width="2" stroke-dasharray="8 6" opacity="0.7"><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="1.5s" repeatCount="indefinite"/></circle>`
    : "";

  // Resolved checkmark burst
  const resolvedBurst = isResolved
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#00ff88" stroke-width="2" opacity="0.6"><animate attributeName="r" from="${r + 3}" to="${r + 18}" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/></circle><circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#00ff88" stroke-width="1.5" opacity="0.8"/>`
    : "";

  // Critical pulse
  const pulse = isCritical && !isResolved
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.5"><animate attributeName="r" from="${r + 3}" to="${r + 16}" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite"/></circle>`
    : "";

  const selectedRing = isSelected
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 2.5}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.8" stroke-dasharray="4 3"><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="-360 ${cx} ${cy}" dur="8s" repeatCount="indefinite"/></circle>`
    : "";

  const effectiveColor = isResolved ? "#00ff88" : color;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
  <filter id="g"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="rg"><stop offset="0%" stop-color="${effectiveColor}" stop-opacity="0.4"/><stop offset="100%" stop-color="${effectiveColor}" stop-opacity="0"/></radialGradient>
</defs>
${resolvedBurst}
${resolvingRing}
${pulse}
<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="url(#rg)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${effectiveColor}" filter="url(#g)" opacity="0.88"/>
<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="#0a1628" opacity="0.5"/>
${inner}
${selectedRing}
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MapView({
  systems,
  selectedSystemId,
  resolvedSystemId,
  resolvingSystemId,
  onSelectSystem,
  onDeselectSystem,
}: MapViewProps) {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_3D_TILES_API_KEY?.trim();
  const hasGoogleKey = Boolean(
    googleKey && !googleKey.includes("YOUR_GOOGLE_MAPS_3D_TILES_API_KEY"),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const handlerRef = useRef<import("cesium").ScreenSpaceEventHandler | null>(null);
  const [ready, setReady] = useState(false);

  const onSelectRef = useRef(onSelectSystem);
  const onDeselectRef = useRef(onDeselectSystem);
  useEffect(() => {
    onSelectRef.current = onSelectSystem;
    onDeselectRef.current = onDeselectSystem;
  }, [onSelectSystem, onDeselectSystem]);

  // --- Initialize Cesium once ---
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || viewerRef.current) return;

      (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium";

      const Cesium = await import("cesium");
      if (cancelled) return;
      cesiumRef.current = Cesium;

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        geocoder: false,
        navigationHelpButton: false,
        homeButton: false,
        infoBox: false,
        selectionIndicator: false,
        shouldAnimate: true,
        orderIndependentTranslucency: false,
      });

      viewer.scene.globe.show = true;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
      viewer.scene.requestRenderMode = false;
      viewer.scene.fog.enabled = true;

      if (hasGoogleKey && googleKey) {
        try {
          const tileset = await Cesium.Cesium3DTileset.fromUrl(
            `https://tile.googleapis.com/v1/3dtiles/root.json?key=${googleKey}`,
          );
          if (!cancelled) viewer.scene.primitives.add(tileset);
        } catch (err) {
          console.error("Google 3D Tiles failed:", err);
        }
      }

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 28000),
        orientation: {
          heading: Cesium.Math.toRadians(20),
          pitch: Cesium.Math.toRadians(-32),
          roll: 0,
        },
      });

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      handler.setInputAction(
        (movement: import("cesium").ScreenSpaceEventHandler.PositionedEvent) => {
          const picked = viewer.scene.pick(movement.position);
          const id = picked && (picked as { id?: { id?: string } }).id?.id;
          if (id && !id.startsWith("__")) {
            onSelectRef.current(toCanonicalSystemId(id));
          } else {
            onDeselectRef.current();
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );

      handler.setInputAction(
        (movement: import("cesium").ScreenSpaceEventHandler.MotionEvent) => {
          const picked = viewer.scene.pick(movement.endPosition);
          const id = picked && (picked as { id?: { id?: string } }).id?.id;
          viewer.canvas.style.cursor = id && !id.startsWith("__") ? "pointer" : "";
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE,
      );

      viewerRef.current = viewer;
      handlerRef.current = handler;
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      handlerRef.current?.destroy();
      handlerRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleKey, hasGoogleKey]);

  // --- Sync entity markers, labels, topology lines, threat zones ---
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !ready) return;

    viewer.entities.removeAll();

    const systemMap = new Map(systems.map((s) => [toCanonicalSystemId(s.id), s]));

    // Topology connection lines
    TOPOLOGY_LINKS.forEach(([a, b], idx) => {
      const sA = systemMap.get(a);
      const sB = systemMap.get(b);
      if (!sA || !sB) return;

      const worst = sA.status === "critical" || sB.status === "critical"
        ? "critical"
        : sA.status === "risk" || sB.status === "risk"
          ? "risk"
          : "healthy";
      const lineColor = Cesium.Color.fromCssColorString(statusColor[worst]).withAlpha(
        worst === "critical" ? 0.4 : worst === "risk" ? 0.25 : 0.12,
      );

      viewer.entities.add({
        id: `__link_${idx}`,
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(sA.location.lng, sA.location.lat, sA.location.alt + 50),
            Cesium.Cartesian3.fromDegrees(sB.location.lng, sB.location.lat, sB.location.alt + 50),
          ],
          width: worst === "critical" ? 2.5 : 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: lineColor,
            dashLength: worst === "critical" ? 12 : 20,
          }),
          clampToGround: false,
        },
      });
    });

    // System markers + labels
    systems.forEach((system) => {
      const canonicalId = toCanonicalSystemId(system.id);
      const selected = canonicalId === selectedSystemId;
      const resolved = canonicalId === resolvedSystemId;
      const resolving = canonicalId === resolvingSystemId;
      const isCritical = system.status === "critical";
      const color = statusColor[system.status];
      const image = buildMarkerSvg(system.system_type, color, selected, isCritical, resolving, resolved);
      const position = Cesium.Cartesian3.fromDegrees(
        system.location.lng,
        system.location.lat,
        system.location.alt,
      );

      // Status label text — always visible
      const statusText = `${system.name}\n${system.status.toUpperCase()} · Risk ${system.risk_score}${resolving ? " · RESOLVING" : ""}${resolved ? " · STABILIZED" : ""}`;

      viewer.entities.add({
        id: canonicalId,
        position,
        billboard: {
          image,
          scale: 1,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: statusText,
          font: selected ? "bold 12px system-ui, sans-serif" : "11px system-ui, sans-serif",
          fillColor: Cesium.Color.fromCssColorString(
            resolved ? "#00ff88" : selected ? "#ffffff" : "#D6E2FF",
          ),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, selected ? 36 : 30),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: selected,
          backgroundColor: selected
            ? Cesium.Color.fromCssColorString("#0a1628").withAlpha(0.85)
            : undefined,
          backgroundPadding: selected ? new Cesium.Cartesian2(8, 5) : undefined,
          scale: selected ? 1 : 0.9,
        },
        point: resolved
          ? {
              color: Cesium.Color.fromCssColorString("#00ff88").withAlpha(0.25),
              pixelSize: 60,
              outlineWidth: 0,
            }
          : undefined,
      });

      // Threat radius zone for critical / risk systems
      if (system.status !== "healthy" && !resolved) {
        const threatRadius = system.status === "critical" ? 1200 : 700;
        viewer.entities.add({
          id: `__threat_${canonicalId}`,
          position,
          ellipse: {
            semiMajorAxis: threatRadius,
            semiMinorAxis: threatRadius,
            material: Cesium.Color.fromCssColorString(color).withAlpha(
              system.status === "critical" ? 0.08 : 0.04,
            ),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    });
  }, [systems, selectedSystemId, resolvedSystemId, resolvingSystemId, ready]);

  // --- Fly to selected entity ---
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !selectedSystemId) return;

    const target = systems.find((s) => toCanonicalSystemId(s.id) === selectedSystemId);
    if (!target) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        target.location.lng,
        target.location.lat,
        4500,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(15),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0,
      },
      duration: 1.6,
    });
  }, [selectedSystemId, systems]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
