"use client";

import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  InfrastructureSystem,
  SystemType,
  statusColor,
} from "@/lib/infrastructure";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MapViewProps {
  systems: InfrastructureSystem[];
  selectedSystemId: string | null;
  resolvedSystemId?: string;
  onSelectSystem: (systemId: string) => void;
  onDeselectSystem: () => void;
}

type CesiumModule = typeof import("cesium");

// ---------------------------------------------------------------------------
// Marker SVG Builder — distinctive per system type + status color
// ---------------------------------------------------------------------------
function buildMarkerSvg(
  systemType: SystemType,
  color: string,
  isSelected: boolean,
  isCritical: boolean,
): string {
  const size = isSelected ? 56 : 46;
  const cx = size / 2;
  const cy = size / 2;
  const r = isSelected ? 15 : 12;

  // --- Inner icon per system type ---
  let inner = "";
  switch (systemType) {
    case "power_grid": {
      // Lightning bolt
      const d = isSelected ? 1.2 : 1;
      inner = `<polygon points="${cx - 3 * d},${cy - 8 * d} ${cx + 2 * d},${cy - 1 * d} ${cx - 1 * d},${cy - 1 * d} ${cx + 3 * d},${cy + 8 * d} ${cx - 2 * d},${cy + 1 * d} ${cx + 1 * d},${cy + 1 * d}" fill="white" opacity="0.95"/>`;
      break;
    }
    case "hydro_plant": {
      // Water drop
      inner = `<path d="M${cx},${cy - 7} Q${cx + 6},${cy + 2} ${cx},${cy + 7} Q${cx - 6},${cy + 2} ${cx},${cy - 7}Z" fill="white" opacity="0.95"/>`;
      break;
    }
    case "data_center": {
      // Stacked servers
      inner = `<rect x="${cx - 5}" y="${cy - 6}" width="10" height="3.5" rx="1" fill="white" opacity="0.95"/><rect x="${cx - 5}" y="${cy - 1.5}" width="10" height="3.5" rx="1" fill="white" opacity="0.8"/><rect x="${cx - 5}" y="${cy + 3}" width="10" height="3.5" rx="1" fill="white" opacity="0.65"/>`;
      break;
    }
    case "substation": {
      // Hexagon
      const hr = 7;
      const hexPts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${(cx + hr * Math.cos(a)).toFixed(1)},${(cy + hr * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      inner = `<polygon points="${hexPts}" fill="none" stroke="white" stroke-width="1.8" opacity="0.9"/>`;
      break;
    }
    case "solar_farm": {
      // Sun + rays
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
    case "sewage_plant": {
      // Recycling circle
      inner = `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="white" stroke-width="1.8" opacity="0.9"/><circle cx="${cx}" cy="${cy}" r="2" fill="white" opacity="0.95"/>`;
      break;
    }
  }

  // Critical systems get animated pulse ring
  const pulse = isCritical
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"><animate attributeName="r" from="${r + 3}" to="${r + 14}" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite"/></circle>`
    : "";

  const selectedRing = isSelected
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-dasharray="3 2"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
  <filter id="g"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="rg"><stop offset="0%" stop-color="${color}" stop-opacity="0.35"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>
</defs>
${pulse}
<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="url(#rg)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" filter="url(#g)" opacity="0.85"/>
<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="#0a1628" opacity="0.55"/>
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

  // Stable callback refs so Cesium init doesn't depend on callback identity
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

      // Scene settings
      viewer.scene.globe.show = true;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
      }
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
      viewer.scene.requestRenderMode = false;
      viewer.scene.fog.enabled = true;

      // Google 3D Tiles if key provided
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

      // Camera: cinematic angle over Bengaluru
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 28000),
        orientation: {
          heading: Cesium.Math.toRadians(20),
          pitch: Cesium.Math.toRadians(-32),
          roll: 0,
        },
      });

      // Input handlers
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      handler.setInputAction(
        (movement: import("cesium").ScreenSpaceEventHandler.PositionedEvent) => {
          const picked = viewer.scene.pick(movement.position);
          const id =
            picked && (picked as { id?: { id?: string } }).id?.id;
          if (id) {
            onSelectRef.current(id);
          } else {
            onDeselectRef.current();
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );

      handler.setInputAction(
        (movement: import("cesium").ScreenSpaceEventHandler.MotionEvent) => {
          const picked = viewer.scene.pick(movement.endPosition);
          const id =
            picked && (picked as { id?: { id?: string } }).id?.id;
          viewer.canvas.style.cursor = id ? "pointer" : "";
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE,
      );

      viewerRef.current = viewer;
      handlerRef.current = handler;
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

  // --- Sync entity markers ---
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    viewer.entities.removeAll();

    systems.forEach((system) => {
      const selected = system.id === selectedSystemId;
      const resolved = system.id === resolvedSystemId;
      const isCritical = system.status === "critical";
      const color = statusColor[system.status];
      const image = buildMarkerSvg(system.system_type, color, selected, isCritical);
      const position = Cesium.Cartesian3.fromDegrees(
        system.location.lng,
        system.location.lat,
        system.location.alt,
      );

      viewer.entities.add({
        id: system.id,
        position,
        billboard: {
          image,
          scale: 1,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: selected
          ? {
              text: system.name,
              font: "13px system-ui, sans-serif",
              fillColor: Cesium.Color.fromCssColorString("#D6E2FF"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, 30),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
          : undefined,
        point: resolved
          ? {
              color: Cesium.Color.fromCssColorString("#00ff88").withAlpha(0.3),
              pixelSize: 45,
              outlineWidth: 0,
            }
          : undefined,
      });
    });
  }, [systems, selectedSystemId, resolvedSystemId]);

  // --- Fly to selected entity ---
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !selectedSystemId) return;

    const target = systems.find((s) => s.id === selectedSystemId);
    if (!target) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        target.location.lng,
        target.location.lat,
        3500,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(15),
        pitch: Cesium.Math.toRadians(-28),
        roll: 0,
      },
      duration: 1.4,
    });
  }, [selectedSystemId, systems]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
