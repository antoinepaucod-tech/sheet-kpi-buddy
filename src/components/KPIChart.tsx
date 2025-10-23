import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartFilter } from "./ChartFilter";

interface KPIChartProps {
  data: any[];
  title: string;
  dataKeys: { key: string; name: string; color: string }[];
  type?: "line" | "bar";
  showFilter?: boolean;
  height?: number;
}

export const KPIChart = ({ data, title, dataKeys, type = "line", showFilter = true, height = 300 }: KPIChartProps) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    dataKeys.map(({ key }) => key)
  );

  const handleToggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredDataKeys = dataKeys.filter(({ key }) => selectedKeys.includes(key));
  const chartData = data.map(item => ({
    name: item.month?.substring(0, 3) || item.month_name?.substring(0, 3) || '',
    ...dataKeys.reduce((acc, { key }) => ({
      ...acc,
      [key]: item[key],
    }), {}),
  }));

  const Chart = type === "line" ? LineChart : BarChart;

  return (
    <Card className="animate-fade-in border border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-medium text-heading tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showFilter && (
          <ChartFilter
            dataKeys={dataKeys}
            selectedKeys={selectedKeys}
            onToggle={handleToggleKey}
          />
        )}
        <ResponsiveContainer width="100%" height={height}>
          <Chart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {filteredDataKeys.map(({ key, name, color }) => (
              type === "line" ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, r: 4 }}
                />
              ) : (
                <Bar
                  key={key}
                  dataKey={key}
                  name={name}
                  fill={color}
                  radius={[8, 8, 0, 0]}
                />
              )
            ))}
          </Chart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
