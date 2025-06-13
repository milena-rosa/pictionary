import React, { useRef, useEffect, useState, useCallback } from "react";
import { sendMessage } from "../api/websocket";
import type { DrawingData } from "../types/game"; // Import DrawingData type

interface DrawingCanvasProps {
  isDrawer: boolean;
  ws: WebSocket | null;
  remoteDrawingStrokes: DrawingData[][]; // Prop to receive all drawing history
  currentDrawingData: DrawingData | null; // Prop to receive real-time drawing point
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  ws,
  remoteDrawingStrokes,
  currentDrawingData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#222");
  const [size, setSize] = useState(4);
  const lastPoint = useRef<{ x: number; y: number } | null>(null); // To track last point for smooth drawing

  // Function to draw a single segment
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

  // Redraw the entire canvas from drawing history
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before redrawing

    remoteDrawingStrokes.forEach((stroke) => {
      if (stroke.length > 0) {
        let prevPoint: { x: number; y: number } | null = null;
        stroke.forEach((data) => {
          if (data.action === "start") {
            prevPoint = { x: data.x, y: data.y };
            drawSegment(ctx, data, null); // For the start of a new stroke
          } else if (data.action === "draw" && prevPoint) {
            drawSegment(ctx, data, prevPoint);
            prevPoint = { x: data.x, y: data.y };
          }
        });
      }
    });
  }, [remoteDrawingStrokes, drawSegment]);

  // Effect to draw remote strokes when they arrive
  useEffect(() => {
    redrawAll(); // Redraw everything when history changes (e.g., new player joins, or full state update)
  }, [remoteDrawingStrokes, redrawAll]);

  // Effect to draw single real-time remote points
  useEffect(() => {
    if (currentDrawingData && !isDrawer) {
      // Only draw if not the current drawer and data exists
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

  // Handle local drawing (for the drawer)
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
    lastPoint.current = null; // Reset last point
    sendDrawingData({ x: 0, y: 0, color, brush_size: size, action: "end" }); // x, y, color, size are placeholders
  };

  // Helper for sending drawing messages
  const sendDrawingData = (data: DrawingData) => {
    if (ws) {
      sendMessage(ws, "DRAWING_DATA", data);
    }
  };

  // Clear canvas
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
    <div className="my-4 bg-white border border-gray-300 rounded-lg flex flex-col items-center shadow-lg p-2">
      <canvas
        ref={canvasRef}
        width={600} // Increased size for better drawing
        height={450} // Increased size
        className="border border-gray-400 rounded"
        style={{
          background: "#fff",
          cursor: isDrawer && ws ? "crosshair" : "not-allowed",
        }}
        onMouseDown={isDrawer ? startDraw : undefined}
        onMouseUp={isDrawer ? endDraw : undefined}
        onMouseLeave={isDrawer ? endDraw : undefined}
        onMouseMove={isDrawer ? draw : undefined}
        onTouchStart={isDrawer ? startDraw : undefined} // Add touch events for mobile
        onTouchEnd={isDrawer ? endDraw : undefined}
        onTouchCancel={isDrawer ? endDraw : undefined}
        onTouchMove={isDrawer ? draw : undefined}
      />
      {isDrawer &&
        ws && ( // Only show controls if current player is drawer AND WebSocket is connected
          <div className="flex flex-wrap items-center justify-center space-x-2 space-y-2 mt-3 p-2 bg-gray-100 rounded-lg shadow-inner">
            <label className="flex items-center space-x-1">
              <span className="text-gray-700 font-medium">Color:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
              />
            </label>
            <label className="flex items-center space-x-2">
              <span className="text-gray-700 font-medium">Size:</span>
              <input
                type="range"
                min={2}
                max={24}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-24 h-4 bg-gray-300 rounded-lg appearance-none cursor-pointer range-lg"
              />
              <span className="text-gray-700 text-sm font-semibold">
                {size}px
              </span>
            </label>
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors duration-200 shadow"
              onClick={clearCanvas}
            >
              Clear
            </button>
          </div>
        )}
      {!ws && isDrawer && (
        <p className="mt-2 text-sm text-red-500">
          Not connected to game server. Drawing is disabled.
        </p>
      )}
    </div>
  );
};

export default DrawingCanvas;
