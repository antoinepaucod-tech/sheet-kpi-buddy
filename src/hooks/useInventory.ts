import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  expected_quantity: number;
  unit: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface InventoryCheck {
  id: string;
  item_id: string;
  year: number;
  month: number;
  month_name: string;
  actual_quantity: number;
  checked_by: string | null;
  notes: string | null;
}

export function useInventory(year: number, month: number) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const MONTHS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, checksRes] = await Promise.all([
      (supabase as any).from("inventory_items").select("*").eq("is_active", true).order("name"),
      (supabase as any).from("inventory_monthly_checks").select("*").eq("year", year).eq("month", month + 1),
    ]);

    if (itemsRes.error) console.error(itemsRes.error);
    if (checksRes.error) console.error(checksRes.error);

    setItems(itemsRes.data || []);
    setChecks(checksRes.data || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addItem = async (name: string, expectedQuantity: number, category?: string, unit?: string) => {
    const { error } = await (supabase as any).from("inventory_items").insert({
      name,
      expected_quantity: expectedQuantity,
      category: category || null,
      unit: unit || "unité",
    });
    if (error) {
      toast.error("Erreur lors de l'ajout");
      return false;
    }
    toast.success("Matériel ajouté");
    await loadData();
    return true;
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    const { error } = await (supabase as any).from("inventory_items").update(updates).eq("id", id);
    if (error) {
      toast.error("Erreur lors de la modification");
      return false;
    }
    toast.success("Matériel modifié");
    await loadData();
    return true;
  };

  const deleteItem = async (id: string) => {
    const { error } = await (supabase as any).from("inventory_items").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
      return false;
    }
    toast.success("Matériel supprimé");
    await loadData();
    return true;
  };

  const upsertCheck = async (itemId: string, actualQuantity: number) => {
    const monthNum = month + 1;
    const { error } = await (supabase as any).from("inventory_monthly_checks").upsert(
      {
        item_id: itemId,
        year,
        month: monthNum,
        month_name: MONTHS[month],
        actual_quantity: actualQuantity,
      },
      { onConflict: "item_id,year,month" }
    );
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return false;
    }
    await loadData();
    return true;
  };

  const getCheckForItem = (itemId: string): InventoryCheck | undefined => {
    return checks.find((c) => c.item_id === itemId);
  };

  // Load previous month data
  const loadPreviousMonthChecks = useCallback(async () => {
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    const { data } = await (supabase as any)
      .from("inventory_monthly_checks")
      .select("*")
      .eq("year", prevYear)
      .eq("month", prevMonth);
    return data || [];
  }, [year, month]);

  return {
    items,
    checks,
    loading,
    addItem,
    updateItem,
    deleteItem,
    upsertCheck,
    getCheckForItem,
    loadPreviousMonthChecks,
    reload: loadData,
  };
}
