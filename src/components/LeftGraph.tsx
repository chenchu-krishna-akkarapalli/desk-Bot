import { useEffect, useRef, useState, useMemo } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

type MetricKey = 'cpu' | 'ram' | 'temp' | 'mbps';

export default function LeftGraph() {
  const history = useSettingsStore((state) => state.metricsHistory);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('cpu');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mouse hover state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const activeInfo = useMemo(() => {
    switch (activeMetric) {
      case 'cpu':
        return { label: 'CPU Usage', unit: '%', color: 'rgb(0, 229, 163)', colorRgb: '0, 229, 163', maxVal: 100 };
      case 'ram':
        return { label: 'RAM Usage', unit: '%', color: 'rgb(245, 158, 11)', colorRgb: '245, 158, 11', maxVal: 100 };
      case 'temp':
        return { label: 'Temperature', unit: '°C', color: 'rgb(239, 68, 68)', colorRgb: '239, 68, 68', maxVal: 100 };
      case 'mbps': {
        // Dynamic scale based on maximum historical Mbps
        const maxHistory = Math.max(...history.map(h => h.mbps), 10);
        const maxVal = Math.ceil(maxHistory / 10) * 10;
        return { label: 'Network Speed', unit: ' Mbps', color: 'rgb(139, 92, 246)', colorRgb: '139, 92, 246', maxVal };
      }
    }
  }, [activeMetric, history]);

  // Redraw canvas on metrics changes, active metric change, or canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on client bounding box (Retina support)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clean drawing space
    ctx.clearRect(0, 0, width, height);

    // Padding inside the graph
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 20;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    // 1. Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6B7280';
    ctx.font = '10px "SF Pro Text", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const gridSteps = [0, 0.25, 0.5, 0.75, 1.0];
    gridSteps.forEach((step) => {
      const y = paddingTop + graphHeight * (1 - step);
      // Line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      // Label (UX Correction: actual unit metric labels on Y-axis)
      const valLabel = Math.round(step * activeInfo.maxVal) + (activeInfo.unit === ' Mbps' ? '' : activeInfo.unit);
      ctx.fillText(valLabel, paddingLeft - 8, y);
    });

    // 2. Map coordinates
    const points = history.map((p, idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * graphWidth;
      
      let val = 0;
      switch (activeMetric) {
        case 'cpu': val = p.cpu; break;
        case 'ram': val = p.ram; break;
        case 'temp': val = p.temp; break;
        case 'mbps': val = p.mbps; break;
      }
      
      const ratio = Math.min(1, Math.max(0, val / activeInfo.maxVal));
      const y = paddingTop + graphHeight * (1 - ratio);
      return { x, y, value: val };
    });

    // 3. Draw comparative baseline line (UX Audit: dashed previous period data)
    // For comparison, we will synthesize a historical comparison curve (delayed by 10s)
    const comparePoints = history.map((_, idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * graphWidth;
      
      // Mocks previous wave slightly offset
      let baseVal = 0;
      const delayedIdx = Math.max(0, idx - 6);
      const delayedPoint = history[delayedIdx];
      switch (activeMetric) {
        case 'cpu': baseVal = delayedPoint.cpu * 0.95; break;
        case 'ram': baseVal = delayedPoint.ram * 0.98; break;
        case 'temp': baseVal = delayedPoint.temp - 1.5; break;
        case 'mbps': baseVal = delayedPoint.mbps * 0.85; break;
      }
      
      const ratio = Math.min(1, Math.max(0, baseVal / activeInfo.maxVal));
      const y = paddingTop + graphHeight * (1 - ratio);
      return { x, y };
    });

    ctx.strokeStyle = 'rgba(156, 163, 175, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(comparePoints[0].x, comparePoints[0].y);
    for (let i = 0; i < comparePoints.length - 1; i++) {
      const cp1x = comparePoints[i].x + (comparePoints[i+1].x - comparePoints[i].x) / 2;
      const cp1y = comparePoints[i].y;
      const cp2x = comparePoints[i].x + (comparePoints[i+1].x - comparePoints[i].x) / 2;
      const cp2y = comparePoints[i+1].y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, comparePoints[i+1].x, comparePoints[i+1].y);
    }
    ctx.stroke();

    // 4. Draw primary wave path (Cubic spline monotone interpolation)
    ctx.strokeStyle = activeInfo.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    
    // Add canvas level drop shadow glow
    ctx.shadowColor = `rgba(${activeInfo.colorRgb}, 0.55)`;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = points[i].x + (points[i+1].x - points[i].x) / 2;
      const cp1y = points[i].y;
      const cp2x = points[i].x + (points[i+1].x - points[i].x) / 2;
      const cp2y = points[i+1].y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i+1].x, points[i+1].y);
    }
    ctx.stroke();

    // Reset shadow values for graph filling
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 5. Draw under-curve translucent vertical fill gradient
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - paddingBottom);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = points[i].x + (points[i+1].x - points[i].x) / 2;
      const cp1y = points[i].y;
      const cp2x = points[i].x + (points[i+1].x - points[i].x) / 2;
      const cp2y = points[i+1].y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i+1].x, points[i+1].y);
    }
    ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
    gradient.addColorStop(0, `rgba(${activeInfo.colorRgb}, 0.20)`);
    gradient.addColorStop(0.5, `rgba(${activeInfo.colorRgb}, 0.08)`);
    gradient.addColorStop(1, `rgba(${activeInfo.colorRgb}, 0.00)`);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 6. Draw X-axis label ticks
    ctx.fillStyle = '#6B7280';
    ctx.font = '10px "SF Pro Text", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // Output X-axis interval time labels
    const intervals = [0, 15, 30, 45, 59];
    intervals.forEach((idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * graphWidth;
      const secDiff = Math.round((history.length - 1 - idx) * 1.5);
      const label = secDiff === 0 ? 'Now' : `-${secDiff}s`;
      ctx.fillText(label, x, height - paddingBottom + 8);
    });

    // 7. Interactive Hover elements
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length) {
      const node = points[hoverIndex];

      // Vertical tracker dashed line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(node.x, paddingTop);
      ctx.lineTo(node.x, height - paddingBottom);
      ctx.stroke();

      // Glowing composite dot node (white center, theme border, halo shadow)
      ctx.fillStyle = `rgba(${activeInfo.colorRgb}, 0.18)`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI); // 18px halo
      ctx.fill();

      ctx.fillStyle = activeInfo.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4.5, 0, 2 * Math.PI); // 9px border
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 2.5, 0, 2 * Math.PI); // 5px inner center
      ctx.fill();
    }
  }, [history, activeMetric, activeInfo, hoverIndex]);

  // Handle mouse movements over the graph container
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;


    const paddingLeft = 35;
    const paddingRight = 15;
    const graphWidth = rect.width - paddingLeft - paddingRight;

    // Calculate nearest metrics historical node index
    const relativeX = x - paddingLeft;
    const percent = Math.min(1, Math.max(0, relativeX / graphWidth));
    const idx = Math.round(percent * (history.length - 1));

    if (idx >= 0 && idx < history.length) {
      setHoverIndex(idx);
      
      // Map screen coords for html badge overlay
      const nodeX = paddingLeft + (idx / (history.length - 1)) * graphWidth;
      
      let val = 0;
      switch (activeMetric) {
        case 'cpu': val = history[idx].cpu; break;
        case 'ram': val = history[idx].ram; break;
        case 'temp': val = history[idx].temp; break;
        case 'mbps': val = history[idx].mbps; break;
      }
      const ratio = Math.min(1, Math.max(0, val / activeInfo.maxVal));
      const nodeY = 15 + (rect.height - 35) * (1 - ratio);

      setMousePos({ x: nodeX + rect.left - containerRef.current!.getBoundingClientRect().left, y: nodeY - 32 });
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div ref={containerRef} className="custom-glass-card p-5 rounded-[20px] flex flex-col h-[320px] relative w-full">
      {/* Header section (Reference layout) */}
      <div className="flex items-start justify-between z-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-white tracking-wide">
            Performance Trend
          </h2>
          {/* Legend Items */}
          <div className="flex items-center gap-4 mt-1">
            <button
              onClick={() => setActiveMetric('cpu')}
              className="flex items-center gap-1.5 transition hover:opacity-80"
            >
              <div 
                className={`h-1 w-2.5 rounded-[2px] transition ${
                  activeMetric === 'cpu' ? 'bg-[#00E5A3]' : 'bg-gray-600'
                }`}
              />
              <span className={`text-[11px] font-medium transition ${
                activeMetric === 'cpu' ? 'text-white' : 'text-gray-400'
              }`}>
                CPU ({history[history.length - 1].cpu.toFixed(0)}%)
              </span>
            </button>

            <button
              onClick={() => setActiveMetric('ram')}
              className="flex items-center gap-1.5 transition hover:opacity-80"
            >
              <div 
                className={`h-1 w-2.5 rounded-[2px] transition ${
                  activeMetric === 'ram' ? 'bg-[#F59E0B]' : 'bg-gray-600'
                }`}
              />
              <span className={`text-[11px] font-medium transition ${
                activeMetric === 'ram' ? 'text-white' : 'text-gray-400'
              }`}>
                RAM ({history[history.length - 1].ram.toFixed(0)}%)
              </span>
            </button>

            <button
              onClick={() => setActiveMetric('temp')}
              className="flex items-center gap-1.5 transition hover:opacity-80"
            >
              <div 
                className={`h-1 w-2.5 rounded-[2px] transition ${
                  activeMetric === 'temp' ? 'bg-[#EF4444]' : 'bg-gray-600'
                }`}
              />
              <span className={`text-[11px] font-medium transition ${
                activeMetric === 'temp' ? 'text-white' : 'text-gray-400'
              }`}>
                Temp ({history[history.length - 1].temp.toFixed(0)}°C)
              </span>
            </button>

            <button
              onClick={() => setActiveMetric('mbps')}
              className="flex items-center gap-1.5 transition hover:opacity-80"
            >
              <div 
                className={`h-1 w-2.5 rounded-[2px] transition ${
                  activeMetric === 'mbps' ? 'bg-[#8B5CF6]' : 'bg-gray-600'
                }`}
              />
              <span className={`text-[11px] font-medium transition ${
                activeMetric === 'mbps' ? 'text-white' : 'text-gray-400'
              }`}>
                Net ({history[history.length - 1].mbps.toFixed(1)} Mbps)
              </span>
            </button>
          </div>
        </div>

        {/* Dropdown selector */}
        <div className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-white">
          <span className="font-medium">1.5s Interval</span>
        </div>
      </div>

      {/* Graph Area */}
      <div 
        className="flex-1 relative mt-4 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Floating active point HTML overlay tooltip badge */}
        {hoverIndex !== null && hoverIndex < history.length && (
          <div
            className="absolute rounded-full pointer-events-none transform -translate-x-1/2 flex items-center justify-center font-semibold text-[11px] h-[26px] px-2.5 shadow-lg"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              backgroundColor: activeInfo.color,
              color: '#000000',
              zIndex: 30
            }}
          >
            {activeMetric === 'cpu' && `${history[hoverIndex].cpu.toFixed(1)}%`}
            {activeMetric === 'ram' && `${history[hoverIndex].ram.toFixed(1)}%`}
            {activeMetric === 'temp' && `${history[hoverIndex].temp.toFixed(1)}°C`}
            {activeMetric === 'mbps' && `${history[hoverIndex].mbps.toFixed(2)} Mbps`}
          </div>
        )}
      </div>
    </div>
  );
}
