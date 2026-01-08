import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  data: Record<string, any>[];
  filename?: string;
  columns?: { key: string; label: string }[];
}

export const ExportButton = ({
  data,
  filename = "export",
  columns,
}: ExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const getHeaders = () => {
    if (columns) {
      return columns.map((col) => col.label);
    }
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  };

  const getKeys = () => {
    if (columns) {
      return columns.map((col) => col.key);
    }
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (typeof value === "number") return value.toString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const headers = getHeaders();
      const keys = getKeys();

      const csvRows = [
        headers.join(";"),
        ...data.map((row) =>
          keys.map((key) => `"${formatValue(row[key]).replace(/"/g, '""')}"`).join(";")
        ),
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for Excel UTF-8
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Export CSV réussi (${data.length} lignes)`);
    } catch (error) {
      toast.error("Erreur lors de l'export");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Export JSON réussi (${data.length} éléments)`);
    } catch (error) {
      toast.error("Erreur lors de l'export");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  if (data.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-2" />
        Exporter
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
        <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2" />
          Export JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
