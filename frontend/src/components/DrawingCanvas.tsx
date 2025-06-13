// DrawingCanvas.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { sendMessage } from "../api/websocket";
import type { DrawingData } from "../types/game";

interface DrawingCanvasProps {
  isDrawer: boolean;
  ws: WebSocket | null;
  remoteDrawingStrokes: DrawingData[][];
  currentDrawingData: DrawingData | null;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  ws,
  remoteDrawingStrokes,
  currentDrawingData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null); // Ref for the hidden color input
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#222");
  const [size, setSize] = useState(4);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const drawSegment = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      data: DrawingData,
      startPoint: { x: number; y: number } | null
    ) => {
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.brush_size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (data.action === "start") {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else if (data.action === "draw" && startPoint) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }
    },
    []
  );

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    remoteDrawingStrokes.forEach((stroke) => {
      if (stroke.length > 0) {
        let prevPoint: { x: number; y: number } | null = null;
        stroke.forEach((data) => {
          if (data.action === "start") {
            prevPoint = { x: data.x, y: data.y };
            drawSegment(ctx, data, null);
          } else if (data.action === "draw" && prevPoint) {
            drawSegment(ctx, data, prevPoint);
            prevPoint = { x: data.x, y: data.y };
          }
        });
      }
    });
  }, [remoteDrawingStrokes, drawSegment]);

  useEffect(() => {
    redrawAll();
  }, [remoteDrawingStrokes, redrawAll]);

  useEffect(() => {
    if (currentDrawingData && !isDrawer) {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const currentX = currentDrawingData.x;
      const currentY = currentDrawingData.y;

      if (currentDrawingData.action === "start") {
        lastPoint.current = { x: currentX, y: currentY };
        drawSegment(ctx, currentDrawingData, null);
      } else if (currentDrawingData.action === "draw" && lastPoint.current) {
        drawSegment(ctx, currentDrawingData, lastPoint.current);
        lastPoint.current = { x: currentX, y: currentY };
      } else if (currentDrawingData.action === "end") {
        lastPoint.current = null;
      } else if (currentDrawingData.action === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastPoint.current = null;
      }
    }
  }, [currentDrawingData, isDrawer, drawSegment]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : e.touches[0].clientX;
    const clientY = "clientY" in e ? e.clientY : e.touches[0].clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) {
      return;
    }
    setDrawing(true);
    const { x, y } = getCoordinates(e);
    lastPoint.current = { x, y };
    sendDrawingData({ x, y, color, brush_size: size, action: "start" });

    const ctx = canvasRef.current!.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer || !drawing) {
      return;
    }
    const { x, y } = getCoordinates(e);
    sendDrawingData({ x, y, color, brush_size: size, action: "draw" });

    const ctx = canvasRef.current!.getContext("2d");
    if (ctx && lastPoint.current) {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastPoint.current = { x, y };
    }
  };

  const endDraw = () => {
    if (!isDrawer || !drawing) {
      return;
    }
    setDrawing(false);
    lastPoint.current = null;
    sendDrawingData({ x: 0, y: 0, color, brush_size: size, action: "end" });
  };

  const sendDrawingData = (data: DrawingData) => {
    if (ws) {
      sendMessage(ws, "DRAWING_DATA", data);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    sendDrawingData({ x: 0, y: 0, color, brush_size: size, action: "clear" });
  };

  return (
    <div className="my-4 bg-white border border-gray-200 rounded-2xl flex flex-col items-center shadow-xl p-4 w-full max-w-xl lg:max-w-2xl">
      <canvas
        ref={canvasRef}
        width={600}
        height={450}
        className="border-2 border-gray-300 rounded-xl bg-white cursor-crosshair shadow-inner"
        style={{
          cursor: isDrawer && ws ? "crosshair" : "not-allowed",
        }}
        onMouseDown={isDrawer ? startDraw : undefined}
        onMouseUp={isDrawer ? endDraw : undefined}
        onMouseLeave={isDrawer ? endDraw : undefined}
        onMouseMove={isDrawer ? draw : undefined}
        onTouchStart={isDrawer ? startDraw : undefined}
        onTouchEnd={isDrawer ? endDraw : undefined}
        onTouchCancel={isDrawer ? endDraw : undefined}
        onTouchMove={isDrawer ? draw : undefined}
      />
      {isDrawer && ws && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 p-3 bg-gray-50 rounded-xl shadow-inner border border-gray-100">
          {/* Color Picker */}
          <label className="flex flex-col items-center space-y-1">
            <span className="text-gray-700 font-semibold text-sm">Color:</span>
            <div
              className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-md cursor-pointer relative"
              style={{ backgroundColor: color }}
              onClick={() => colorInputRef.current?.click()} // Trigger hidden input click
            >
              <input
                type="color"
                ref={colorInputRef}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer" // Hidden but clickable
                aria-label="Select brush color"
              />
            </div>
          </label>
          {/* Size Picker */}
          <label className="flex flex-col items-center space-y-1">
            <span className="text-gray-700 font-semibold text-sm">
              Brush Size:
            </span>
            <input
              type="range"
              min={2}
              max={24}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-28 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-indigo-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md"
              aria-label="Select brush size"
            />
            <span className="text-gray-700 text-xs font-semibold">
              {size}px
            </span>
          </label>
          {/* Clear Button */}
          <button
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors duration-200 shadow-md transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 cursor-pointer"
            onClick={clearCanvas}
          >
            Clear Drawing
          </button>
        </div>
      )}
      {!ws && isDrawer && (
        <p className="mt-3 text-sm text-red-500 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
          <span role="img" aria-label="warning">
            ⚠️
          </span>{" "}
          Not connected to game server. Drawing is disabled.
        </p>
      )}
    </div>
  );
};

export default DrawingCanvas;
