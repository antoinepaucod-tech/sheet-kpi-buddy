import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AccountingFiltersProps {
  categories: string[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  minAmount: string;
  maxAmount: string;
  onMinAmountChange: (amount: string) => void;
  onMaxAmountChange: (amount: string) => void;
  showValidatedOnly: boolean;
  showUnvalidatedOnly: boolean;
  onValidatedOnlyChange: (checked: boolean) => void;
  onUnvalidatedOnlyChange: (checked: boolean) => void;
  onReset: () => void;
  totalTransactions: number;
  filteredTransactions: number;
}

export const AccountingFilters = ({
  categories,
  selectedCategories,
  onCategoryChange,
  searchText,
  onSearchChange,
  minAmount,
  maxAmount,
  onMinAmountChange,
  onMaxAmountChange,
  showValidatedOnly,
  showUnvalidatedOnly,
  onValidatedOnlyChange,
  onUnvalidatedOnlyChange,
  onReset,
  totalTransactions,
  filteredTransactions,
}: AccountingFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = 
    selectedCategories.length + 
    (searchText ? 1 : 0) + 
    (minAmount ? 1 : 0) + 
    (maxAmount ? 1 : 0) + 
    (showValidatedOnly ? 1 : 0) + 
    (showUnvalidatedOnly ? 1 : 0);

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoryChange([...selectedCategories, category]);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Filtres
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          <div className="text-sm text-muted-foreground">
            {filteredTransactions} / {totalTransactions} transactions
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Réinitialiser
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-3">
        <div className="p-4 bg-background rounded-lg border border-border space-y-4">
          {/* Search */}
          <div>
            <Label className="text-sm font-medium">Recherche (Client/Fournisseur)</Label>
            <Input
              placeholder="Rechercher..."
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Montant min.</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="0"
                value={minAmount}
                onChange={(e) => onMinAmountChange(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Montant max.</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="∞"
                value={maxAmount}
                onChange={(e) => onMaxAmountChange(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Validation Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Statut</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="validated"
                  checked={showValidatedOnly}
                  onCheckedChange={onValidatedOnlyChange}
                />
                <Label htmlFor="validated" className="text-sm font-normal cursor-pointer">
                  Validées uniquement
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="unvalidated"
                  checked={showUnvalidatedOnly}
                  onCheckedChange={onUnvalidatedOnlyChange}
                />
                <Label htmlFor="unvalidated" className="text-sm font-normal cursor-pointer">
                  À valider uniquement
                </Label>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Catégories ({selectedCategories.length}/{categories.length})
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/30 rounded">
              {categories.map((category) => (
                <div key={category} className="flex items-center gap-2">
                  <Checkbox
                    id={`cat-${category}`}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  <Label
                    htmlFor={`cat-${category}`}
                    className="text-sm font-normal cursor-pointer truncate"
                  >
                    {category}
                  </Label>
                </div>
              ))}
            </div>
            {categories.length > 0 && selectedCategories.length < categories.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCategoryChange(categories)}
                className="w-full mt-2"
              >
                Tout sélectionner
              </Button>
            )}
            {selectedCategories.length === categories.length && categories.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCategoryChange([])}
                className="w-full mt-2"
              >
                Tout désélectionner
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
