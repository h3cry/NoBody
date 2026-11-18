
type PerformanceChartProps = {
  title: string;
  subtitle: string;
  data: number[];
  color: string;
  suffix?: string;
};

export default function PerformanceChart({
  title,
  subtitle,
  data,
  color,
  suffix = "%",
}: PerformanceChartProps) {
  const width = 600;
  const height = 170;
  const padding = 12;

  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (Math.min(Math.max(value, 0), 100) / 100) * (height - padding * 2);

    return { x, y };
  });

  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${points[0].x},${height - padding} ${line} ${points[points.length - 1].x},${height - padding}`
    : "";

  const current = data.length ? data[data.length - 1] : 0;

  return (
    <div className="performance-chart panel">
      <div className="performance-chart-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <strong style={{ color }}>
          {current.toFixed(1)}{suffix}
        </strong>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="performance-chart-svg"
        preserveAspectRatio="none"
      >
        {[25, 50, 75].map((level) => {
          const y = height - padding - (level / 100) * (height - padding * 2);
          return (
            <line
              key={level}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#29303d"
              strokeDasharray="5 5"
            />
          );
        })}

        {points.length > 1 && (
          <>
            <polygon points={area} fill={color} opacity="0.10" />
            <polyline
              points={line}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="5"
              fill={color}
            />
          </>
        )}
      </svg>

      <div className="performance-chart-footer">
        <span>60 seconds history</span>
        <span>{data.length} samples</span>
      </div>
    </div>
  );
}
