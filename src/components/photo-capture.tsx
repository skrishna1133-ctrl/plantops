"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, RotateCcw, Sparkles, Crop, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage, enhanceDocument, cropImage } from "@/lib/image-utils";

interface PhotoCaptureProps {
  photoUrl?: string;
  onPhotoChange: (url: string | undefined) => void;
  label?: string;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function PhotoCapture({
  photoUrl,
  onPhotoChange,
  label = "Photo",
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 10, y: 10, width: 80, height: 80 });
  const [processing, setProcessing] = useState(false);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: string; startX: number; startY: number; startCrop: CropBox } | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const raw = reader.result as string;
      const compressed = await compressImage(raw);
      const enhancedImg = await enhanceDocument(compressed);
      setOriginal(compressed);
      setPreview(enhancedImg);
      setEnhanced(true);
      setProcessing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const toggleEnhance = async () => {
    if (!original || !preview) return;
    setProcessing(true);
    if (enhanced) {
      setPreview(original);
      setEnhanced(false);
    } else {
      const enhancedImg = await enhanceDocument(original);
      setPreview(enhancedImg);
      setEnhanced(true);
    }
    setProcessing(false);
  };

  const startCrop = () => {
    setCropping(true);
    setCropBox({ x: 10, y: 10, width: 80, height: 80 });
  };

  const applyCrop = async () => {
    if (!preview) return;
    setProcessing(true);
    const cropped = await cropImage(preview, cropBox);
    setPreview(cropped);
    setOriginal(cropped);
    setCropping(false);
    setEnhanced(false);
    setProcessing(false);
  };

  const accept = () => {
    if (preview) {
      onPhotoChange(preview);
      setPreview(null);
      setOriginal(null);
      setEnhanced(false);
    }
  };

  const discard = () => {
    setPreview(null);
    setOriginal(null);
    setEnhanced(false);
    setCropping(false);
  };

  const handleCropMouseDown = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropBox },
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current || !cropContainerRef.current) return;
      const rect = cropContainerRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
      const sc = dragRef.current.startCrop;

      if (type === "move") {
        setCropBox({
          x: Math.max(0, Math.min(100 - sc.width, sc.x + dx)),
          y: Math.max(0, Math.min(100 - sc.height, sc.y + dy)),
          width: sc.width,
          height: sc.height,
        });
      } else if (type === "se") {
        setCropBox({
          x: sc.x,
          y: sc.y,
          width: Math.max(10, Math.min(100 - sc.x, sc.width + dx)),
          height: Math.max(10, Math.min(100 - sc.y, sc.height + dy)),
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Show accepted photo
  if (photoUrl && !preview) {
    return (
      <div className="space-y-1">
        <div className="relative w-20 h-20">
          <img
            src={photoUrl}
            alt={label}
            className="w-20 h-20 object-cover rounded border border-border"
          />
          <button
            type="button"
            onClick={() => onPhotoChange(undefined)}
            className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
          >
            <X size={10} />
          </button>
        </div>
      </div>
    );
  }

  // Show preview with enhance/crop options
  if (preview) {
    return (
      <div className="space-y-2">
        <div className="relative" ref={cropContainerRef}>
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-contain rounded border border-border"
          />
          {cropping && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.width}%`,
                height: `${cropBox.height}%`,
              }}
              onMouseDown={(e) => handleCropMouseDown(e, "move")}
            >
              <div
                className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "se")}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {!cropping ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={toggleEnhance} disabled={processing}>
                <Sparkles size={12} className="mr-1" />
                {enhanced ? "Original" : "Enhance"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={startCrop} disabled={processing}>
                <Crop size={12} className="mr-1" />
                Crop
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={discard}>
                <RotateCcw size={12} className="mr-1" />
                Retake
              </Button>
              <Button type="button" size="sm" onClick={accept} disabled={processing}>
                <Check size={12} className="mr-1" />
                Accept
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" onClick={applyCrop} disabled={processing}>
                <Check size={12} className="mr-1" />
                Apply Crop
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setCropping(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show capture button
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => fileInputRef.current?.click()}
        disabled={processing}
      >
        <Camera size={12} className="mr-1" />
        {label}
      </Button>
    </div>
  );
}
