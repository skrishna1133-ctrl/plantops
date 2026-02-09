"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { incidentReportSchema, type IncidentReportInput } from "@/lib/schemas";

interface IncidentReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function IncidentReportDialog({
  open,
  onOpenChange,
}: IncidentReportDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const localISOString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<IncidentReportInput>({
    resolver: zodResolver(incidentReportSchema),
    defaultValues: {
      incidentDate: localISOString,
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: IncidentReportInput) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
      });
      if (photoFile) {
        formData.append("photo", photoFile);
      }

      const response = await fetch("/api/incidents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to submit incident report");
      }

      const result = await response.json();
      setTicketId(result.ticketId);
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting incident:", error);
      alert("Failed to submit incident report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setSubmitted(false);
      setTicketId("");
      setPhotoPreview(null);
      setPhotoFile(null);
      reset();
    }, 200);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle2 className="text-green-500" size={64} />
            <DialogTitle className="text-xl">Incident Reported</DialogTitle>
            <p className="text-muted-foreground">
              Your incident has been logged successfully.
            </p>
            <div className="bg-muted rounded-lg px-4 py-2">
              <p className="text-xs text-muted-foreground">Ticket ID</p>
              <p className="text-lg font-mono font-bold">{ticketId}</p>
            </div>
            <Button onClick={handleClose} className="mt-4">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>
            Fill in the details below to report an incident. All fields marked
            with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* Reporter Name */}
          <div className="space-y-2">
            <Label htmlFor="reporterName">Your Name *</Label>
            <Input
              id="reporterName"
              placeholder="Enter your full name"
              {...register("reporterName")}
            />
            {errors.reporterName && (
              <p className="text-sm text-red-500">{errors.reporterName.message}</p>
            )}
          </div>

          {/* Plant Selection */}
          <div className="space-y-2">
            <Label htmlFor="plant">Plant *</Label>
            <Select onValueChange={(value) => setValue("plant", value as IncidentReportInput["plant"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select plant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plant-a">Plant A</SelectItem>
                <SelectItem value="plant-b">Plant B</SelectItem>
              </SelectContent>
            </Select>
            {errors.plant && (
              <p className="text-sm text-red-500">{errors.plant.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select onValueChange={(value) => setValue("category", value as IncidentReportInput["category"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="environmental">Environmental</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-500">{errors.category.message}</p>
            )}
          </div>

          {/* Incident Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="incidentDate">Date & Time of Incident *</Label>
            <Input
              id="incidentDate"
              type="datetime-local"
              {...register("incidentDate")}
            />
            {errors.incidentDate && (
              <p className="text-sm text-red-500">{errors.incidentDate.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the incident in detail..."
              rows={4}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Criticality */}
          <div className="space-y-2">
            <Label htmlFor="criticality">Criticality *</Label>
            <Select onValueChange={(value) => setValue("criticality", value as IncidentReportInput["criticality"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select criticality level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Minor
                  </div>
                </SelectItem>
                <SelectItem value="major">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Major
                  </div>
                </SelectItem>
                <SelectItem value="critical">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Critical
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.criticality && (
              <p className="text-sm text-red-500">{errors.criticality.message}</p>
            )}
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Photo (Optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoPreview ? (
              <div className="relative w-full">
                <img
                  src={photoPreview}
                  alt="Incident photo preview"
                  className="w-full max-h-48 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-20 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-2" size={20} />
                Take or Upload Photo
              </Button>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
