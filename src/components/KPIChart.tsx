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

export const KPIChart = ({ data, title, dataKeys, type = "line", showFilter = true, height = 350 }: KPIChartProps) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    dataKeys.map(({ key }) => key)
  );

  const handleToggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredDataKeys = dataKeys.filter(({ key }) => selectedKeys.includes(key));
  const chartData = data.map(item => {
    let name = '';
    if (typeof item.month === 'string') {
      name = item.month.substring(0, 3);
    } else if (item.month_name && typeof item.month_name === 'string') {
      name = item.month_name.substring(0, 3);
    }
    
    return {
      name,
      ...dataKeys.reduce((acc, { key }) => ({
        ...acc,
        [key]: item[key],
      }), {}),
    };
  });

  const Chart = type === "line" ? LineChart : BarChart;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-heading">{title}</CardTitle>
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
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="none" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              stroke="var(--color-text-secondary)"
              style={{ fontSize: 'var(--text-xs)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="var(--color-text-secondary)"
              style={{ fontSize: 'var(--text-xs)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                color: 'var(--color-text-primary)',
              }}
              labelStyle={{ fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-primary)' }}
              itemStyle={{ color: 'var(--color-text-secondary)' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconSize={14}
            />
            {filteredDataKeys.map(({ key, name, color }) => (
              type === "line" ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ) : (
                <Bar
                  key={key}
                  dataKey={key}
                  name={name}
                  fill={color}
                  radius={[6, 6, 0, 0]}
                />
              )
            ))}
          </Chart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
