import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ChartFilterProps {
  dataKeys: { key: string; name: string; color: string }[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}

export const ChartFilter = ({ dataKeys, selectedKeys, onToggle }: ChartFilterProps) => {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
      {dataKeys.map(({ key, name, color }) => (
        <div key={key} className="flex items-center space-x-2">
          <Checkbox
            id={key}
            checked={selectedKeys.includes(key)}
            onCheckedChange={() => onToggle(key)}
          />
          <Label
            htmlFor={key}
            className="text-sm font-medium cursor-pointer flex items-center gap-2"
          >
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {name}
          </Label>
        </div>
      ))}
    </div>
  );
};
