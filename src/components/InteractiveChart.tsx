import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartFilter } from "@/components/ChartFilter";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

interface DataKey {
  key: string;
  name: string;
  color: string;
}

interface InteractiveChartProps {
  data: any[];
  title: string;
  dataKeys: DataKey[];
  type?: "line" | "bar";
  height?: number;
  showFilter?: boolean;
  showComparison?: boolean;
  comparisonData?: any[];
  comparisonLabel?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="font-semibold text-sm mb-2 text-foreground">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium text-foreground">
              {typeof entry.value === 'number' 
                ? entry.value.toLocaleString('fr-CH', { maximumFractionDigits: 0 })
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const InteractiveChart = ({
  data,
  title,
  dataKeys,
  type = "line",
  height = 350,
  showFilter = true,
  showComparison = false,
  comparisonData,
  comparisonLabel = "Comparaison",
}: InteractiveChartProps) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(dataKeys.map(dk => dk.key));
  const [showComparisonLine, setShowComparisonLine] = useState(false);

  const handleToggleKey = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const filteredDataKeys = dataKeys.filter(dk => selectedKeys.includes(dk.key));

  const averageValues = useMemo(() => {
    if (!data.length) return {};
    const avg: Record<string, number> = {};
    dataKeys.forEach(dk => {
      const values = data.map(d => d[dk.key] || 0).filter(v => v > 0);
      if (values.length) {
        avg[dk.key] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });
    return avg;
  }, [data, dataKeys]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {showComparison && comparisonData && (
              <Button
                variant={showComparisonLine ? "default" : "outline"}
                size="sm"
                onClick={() => setShowComparisonLine(!showComparisonLine)}
                className="text-xs"
              >
                {comparisonLabel}
              </Button>
            )}
            {showFilter && (
              <ChartFilter
                dataKeys={dataKeys}
                selectedKeys={selectedKeys}
                onToggle={handleToggleKey}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {type === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(value) => value.toLocaleString('fr-CH', { notation: 'compact' })}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: "1rem" }}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
              {filteredDataKeys.map((dk) => (
                <Line
                  key={dk.key}
                  type="monotone"
                  dataKey={dk.key}
                  name={dk.name}
                  stroke={dk.color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ))}
              {showComparisonLine && filteredDataKeys.map((dk) => (
                averageValues[dk.key] && (
                  <ReferenceLine
                    key={`avg-${dk.key}`}
                    y={averageValues[dk.key]}
                    stroke={dk.color}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                )
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(value) => value.toLocaleString('fr-CH', { notation: 'compact' })}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: "1rem" }}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
              {filteredDataKeys.map((dk) => (
                <Bar
                  key={dk.key}
                  dataKey={dk.key}
                  name={dk.name}
                  fill={dk.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
