import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface KPIChartProps {
  data: any[];
  title: string;
  dataKeys: { key: string; name: string; color: string }[];
  type?: "line" | "bar";
}

export const KPIChart = ({ data, title, dataKeys, type = "line" }: KPIChartProps) => {
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
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
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
            {dataKeys.map(({ key, name, color }) => (
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
