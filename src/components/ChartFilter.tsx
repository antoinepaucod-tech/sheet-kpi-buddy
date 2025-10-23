import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter } from "lucide-react";

interface ChartFilterProps {
  dataKeys: { key: string; name: string; color: string }[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}

export const ChartFilter = ({ dataKeys, selectedKeys, onToggle }: ChartFilterProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtres ({selectedKeys.length}/{dataKeys.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-56 max-h-[400px] overflow-y-auto bg-card/95 backdrop-blur-sm z-50"
      >
        <DropdownMenuLabel>Afficher les données</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {dataKeys.map(({ key, name, color }) => (
          <DropdownMenuItem
            key={key}
            className="flex items-center gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              onToggle(key);
            }}
          >
            <Checkbox
              checked={selectedKeys.includes(key)}
              onCheckedChange={() => onToggle(key)}
              className="pointer-events-none"
            />
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="flex-1">{name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
