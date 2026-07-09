import { useState, useMemo } from 'react';
import LeftGraph from './LeftGraph';
import StorageCard from './StorageCard';
import SettingsGear from './SettingsGear';
import ScanningPanel from './WorkspaceCleaner/ScanningPanel';
import ClipboardShield from './ClipboardShield';
import UsbShield from './UsbShield';
import SandboxPanel from './SandboxPanel';
import { useSettingsStore } from '../store/useSettingsStore';
import { useScreenTime } from '../hooks/useScreenTime';
import { usePlayerStore } from '../store/usePlayerStore';
import { 
  Settings, 
  Cpu, 
  Activity, 
  Thermometer, 
  Wifi, 
  ArrowUpRight, 
  ArrowDownRight, 
  ListFilter,
  Search, 
  MoreVertical,
  Timer,
  Eye,
  Droplets,
  Heart
} from 'lucide-react';

export default function Dashboard() {
  const { 
    isIdle,
    eyeBreakProgress,
    movementBreakProgress,
    activeWorkSeconds,
    eyeBreakDue,
    movementBreakDue,
    resetEyeBreak,
    resetMovementBreak,
    waterIntakeMl,
    stepsToday,
    addWater,
    addSteps,
  } = useScreenTime();

  const { isBreakActive, breakCountdown, setBreakActive } = usePlayerStore();
  const metrics = useSettingsStore((state) => state.currentMetrics);
  const history = useSettingsStore((state) => state.metricsHistory);
  
  const [activeTab, setActiveTab] = useState<'system' | 'wellness' | 'cleaner'>('system');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');



  // Daily hydration goal calculation based on standard weight (70kg)
  const weight = 70;
  const dailyGoal = weight * 35; // 2450ml
  const stepsProgress = Math.min(1, stepsToday / 10000);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // 1. KPI Metric Mini Wave Helpers
  const getSvgPath = (key: 'cpu' | 'ram' | 'temp' | 'mbps' | 'water' | 'steps', maxVal = 100) => {
    const points = history.slice(-12).map((h, idx) => {
      const x = (idx / 11) * 160;
      let val = 0;
      if (key === 'cpu') val = h.cpu;
      else if (key === 'ram') val = h.ram;
      else if (key === 'temp') val = h.temp;
      else if (key === 'mbps') val = h.mbps;
      // Synthetic wave history for wellness metrics
      else if (key === 'water') val = waterIntakeMl * 0.9;
      else if (key === 'steps') val = stepsToday * 0.95;
      
      const ratio = Math.min(1, Math.max(0, val / maxVal));
      const y = 35 - ratio * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    if (points.length === 0) return { line: '', fill: '' };
    return {
      line: `M ${points.join(' L ')}`,
      fill: `M 0,38 L ${points.join(' L ')} L 160,38 Z`
    };
  };

  const cpuPaths = useMemo(() => getSvgPath('cpu', 100), [history]);
  const ramPaths = useMemo(() => getSvgPath('ram', 100), [history]);
  const tempPaths = useMemo(() => getSvgPath('temp', 100), [history]);
  const mbpsPaths = useMemo(() => {
    const maxVal = Math.max(...history.map(h => h.mbps), 10);
    return getSvgPath('mbps', maxVal);
  }, [history]);

  const waterPaths = useMemo(() => getSvgPath('water', dailyGoal), [waterIntakeMl]);
  const stepsPaths = useMemo(() => getSvgPath('steps', 10000), [stepsToday]);

  // 2. Mock lists
  const topProcesses = [
    { name: 'chrome.exe', cpu: '24.2%', rating: '4.9', status: 'Active' },
    { name: 'code.exe', cpu: '14.8%', rating: '4.8', status: 'Active' },
    { name: 'rustc.exe', cpu: '8.4%', rating: '4.7', status: 'Idle' },
  ];

  const connections = [
    { id: 'CONN-5049', target: 'github.com', localPort: '8443', rate: '2.4 Mbps', protocol: 'TCP/TLS', status: 'Active', statusColor: 'bg-emerald-500/10 text-emerald-400', date: 'Sept 17' },
    { id: 'CONN-8912', target: 'google.com', localPort: '443', rate: '0.8 Mbps', protocol: 'UDP/QUIC', status: 'Active', statusColor: 'bg-emerald-500/10 text-emerald-400', date: 'Sept 17' },
    { id: 'CONN-2348', target: 'John.D-server', localPort: '8080', rate: '0.0 Mbps', protocol: 'HTTP', status: 'Closed', statusColor: 'bg-rose-500/10 text-rose-400', date: 'Sept 16' },
  ];

  const wellnessLogs = [
    { id: 'LOG-3091', action: 'Water intake logged', time: '10:14 AM', amount: '+250 ml', status: 'Logged', color: 'bg-cyan-500/10 text-cyan-400' },
    { id: 'LOG-3090', action: 'Water intake logged', time: '09:30 AM', amount: '+500 ml', status: 'Logged', color: 'bg-cyan-500/10 text-cyan-400' },
    { id: 'LOG-3088', action: 'Steps incremented', time: '08:45 AM', amount: '+100 steps', status: 'Updated', color: 'bg-emerald-500/10 text-emerald-400' },
  ];

  const filteredConnections = connections.filter(c => 
    c.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWellnessLogs = wellnessLogs.filter(l =>
    l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isBreakActive) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 bg-[#090C0E]/95">
        <h1 className="font-rounded text-4xl font-semibold text-white">
          Ergonomic Break
        </h1>
        <div className="text-6xl font-bold text-theme-accent">
          {Math.floor(breakCountdown / 60)}:{String(breakCountdown % 60).padStart(2, '0')}
        </div>
        <p className="text-sm text-theme-text-secondary">Please rest your eyes and stretch</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-5 p-6 overflow-y-auto">
      {/* Header section (Reference layout styling) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-theme-accent flex items-center justify-center">
            <Activity size={18} className="text-black" />
          </div>
          <span className="font-rounded text-lg font-bold text-white tracking-wide">
            DeskWell Monitor
          </span>
          
          {/* Tab switches */}
          <div className="flex items-center gap-1.5 ml-4 bg-white/5 border border-white/8 rounded-full p-1">
            <button
              onClick={() => { setActiveTab('system'); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-theme-accent text-black shadow-md'
                  : 'text-theme-text-secondary hover:text-white'
              }`}
            >
              System Metrics
            </button>
            <button
              onClick={() => { setActiveTab('wellness'); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                activeTab === 'wellness'
                  ? 'bg-theme-accent text-black shadow-md'
                  : 'text-theme-text-secondary hover:text-white'
              }`}
            >
              Ergonomic Wellness
            </button>
            <button
              onClick={() => { setActiveTab('cleaner'); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                activeTab === 'cleaner'
                  ? 'bg-theme-accent text-black shadow-md'
                  : 'text-theme-text-secondary hover:text-white'
              }`}
            >
              Workspace Cleaner
            </button>
          </div>
        </div>

        {/* Global state indicator & Settings gear */}
        <div className="flex items-center gap-4 justify-between sm:justify-start">
          <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-full px-3 py-1 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isIdle ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span className="text-theme-text-secondary font-medium font-mono">
              {isIdle ? 'IDLE' : 'ACTIVE'}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 border border-white/8 hover:bg-white/12 text-white transition cursor-pointer"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* RENDER VIEW: SYSTEM DIAGNOSTICS */}
      {activeTab === 'system' && (
        <>
          {/* Row 1: KPI Cards Grid */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* KPI Card 1: CPU load */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(0, 229, 163, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(0,229,163,0.12)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-theme-green" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">CPU Load</span>
                </div>
                <div className="h-7 w-7 rounded-full border border-white/8 flex items-center justify-center text-white">
                  <ArrowUpRight size={13} className="text-theme-green" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2 z-10">
                <span className="font-rounded text-2xl font-bold text-white">{metrics.cpu.toFixed(0)}%</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">+6.25%</span>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">since boot-up</div>
              <div className="absolute bottom-0 left-0 right-0 h-[38px] pointer-events-none opacity-70">
                <svg className="w-full h-full">
                  <path d={cpuPaths.fill} fill="rgba(0, 229, 163, 0.06)" />
                  <path d={cpuPaths.line} fill="transparent" stroke="rgb(0, 229, 163)" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* KPI Card 2: RAM load */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.1)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-theme-yellow" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">RAM Load</span>
                </div>
                <div className="h-7 w-7 rounded-full border border-white/8 flex items-center justify-center text-white">
                  <ArrowUpRight size={13} className="text-theme-yellow" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2 z-10">
                <span className="font-rounded text-2xl font-bold text-white">{metrics.ram.toFixed(0)}%</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">+1.25%</span>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">system memory usage</div>
              <div className="absolute bottom-0 left-0 right-0 h-[38px] pointer-events-none opacity-70">
                <svg className="w-full h-full">
                  <path d={ramPaths.fill} fill="rgba(245, 158, 11, 0.06)" />
                  <path d={ramPaths.line} fill="transparent" stroke="rgb(245, 158, 11)" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* KPI Card 3: Network speed */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.1)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Wifi size={16} className="text-theme-purple" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Network</span>
                </div>
                <div className="h-7 w-7 rounded-full border border-white/8 flex items-center justify-center text-white">
                  <ArrowUpRight size={13} className="text-theme-purple" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2 z-10">
                <span className="font-rounded text-2xl font-bold text-white">{metrics.mbps.toFixed(1)}M</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-semibold">Mbps</span>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">current transfer rate</div>
              <div className="absolute bottom-0 left-0 right-0 h-[38px] pointer-events-none opacity-70">
                <svg className="w-full h-full">
                  <path d={mbpsPaths.fill} fill="rgba(139, 92, 246, 0.06)" />
                  <path d={mbpsPaths.line} fill="transparent" stroke="rgb(139, 92, 246)" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* KPI Card 4: Temperature */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(239,68,68,0.1)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Thermometer size={16} className="text-theme-red" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">System Temp</span>
                </div>
                <div className="h-7 w-7 rounded-full border border-white/8 flex items-center justify-center text-white">
                  <ArrowDownRight size={13} className="text-theme-red" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2 z-10">
                <span className="font-rounded text-2xl font-bold text-white">{metrics.temp.toFixed(0)}°C</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold">-4.05%</span>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">hardware core sensor</div>
              <div className="absolute bottom-0 left-0 right-0 h-[38px] pointer-events-none opacity-70">
                <svg className="w-full h-full">
                  <path d={tempPaths.fill} fill="rgba(239, 68, 68, 0.06)" />
                  <path d={tempPaths.line} fill="transparent" stroke="rgb(239, 68, 68)" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </section>

          {/* Row 2: Graph, Storage & Top Processes */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7 flex">
              <LeftGraph />
            </div>

            <div className="lg:col-span-3 flex flex-col gap-4">
              <StorageCard />
            </div>

            <div className="lg:col-span-2 flex">
              <div className="custom-glass-card p-4 rounded-[20px] flex flex-col justify-between h-[320px] w-full">
                <div>
                  <div className="flex items-center justify-between pb-1 text-theme-text-secondary">
                    <span className="text-xs font-semibold uppercase tracking-wider font-rounded">Top Processes</span>
                  </div>
                  <div className="flex flex-col gap-2 mt-3">
                    {topProcesses.map((proc, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-white truncate max-w-[90px]">{proc.name}</span>
                          <span className="text-[9px] text-theme-text-tertiary">Priority: {proc.rating}</span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[11px] font-bold text-white">{proc.cpu}</span>
                          <span className="text-[9px] text-theme-accent font-semibold">{proc.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Row 3: Connections logs */}
          <section className="flex">
            <div className="custom-glass-card p-5 rounded-[20px] w-full flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-base font-semibold text-white tracking-wide font-rounded">
                  Active Network Connections
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <Search size={13} className="absolute left-3 text-theme-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Search target..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-[160px] sm:w-[200px] bg-white/5 border border-white/8 rounded-full text-xs text-white focus:outline-none focus:border-theme-accent"
                    />
                  </div>
                  <button className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-white">
                    <ListFilter size={12} />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-theme-text-tertiary uppercase tracking-wider font-semibold border-b border-white/8">
                      <th className="py-2.5 px-3">Connection ID</th>
                      <th className="py-2.5 px-3">Host Target</th>
                      <th className="py-2.5 px-3">Port</th>
                      <th className="py-2.5 px-3">Bandwidth Rate</th>
                      <th className="py-2.5 px-3">Protocol</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConnections.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-theme-text-tertiary">No records found</td>
                      </tr>
                    ) : (
                      filteredConnections.map((conn) => (
                        <tr key={conn.id} className="border-b border-white/5 hover:bg-white/3 transition">
                          <td className="py-2.5 px-3 font-mono text-white">{conn.id}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{conn.target}</td>
                          <td className="py-2.5 px-3 text-theme-text-secondary">{conn.localPort}</td>
                          <td className="py-2.5 px-3 font-medium text-white">{conn.rate}</td>
                          <td className="py-2.5 px-3 text-theme-text-secondary">{conn.protocol}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${conn.statusColor}`}>
                              {conn.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-theme-text-secondary">{conn.date}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button className="h-6 w-6 rounded flex items-center justify-center hover:bg-white/10 text-theme-text-secondary hover:text-white transition">
                              <MoreVertical size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {/* RENDER VIEW: ERGONOMIC WELLNESS */}
      {activeTab === 'wellness' && (
        <>
          {/* Row 1: Wellness KPI Cards Grid */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* KPI 1: Active Work Time */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(0, 229, 163, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(0,229,163,0.12)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Timer size={16} className="text-theme-green" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Active Work</span>
                </div>
                <div className="h-7 w-7 rounded-full border border-white/8 flex items-center justify-center text-white">
                  <ArrowUpRight size={13} className="text-theme-green" />
                </div>
              </div>
              <div className="mt-2 z-10">
                <span className="font-rounded text-2xl font-bold text-white">{formatTime(activeWorkSeconds)}</span>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">screen active duration</div>
              <div className="absolute bottom-0 left-0 right-0 h-[38px] pointer-events-none opacity-70" />
            </div>

            {/* KPI 2: Eye Fatigue progress */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.1)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-theme-yellow" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Eye Health</span>
                </div>
                {eyeBreakDue && (
                  <button 
                    onClick={resetEyeBreak}
                    className="h-6 px-2 text-[9px] font-bold rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/30"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-col z-10">
                <span className="font-rounded text-2xl font-bold text-white">{Math.round(eyeBreakProgress * 100)}%</span>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-theme-yellow rounded-full transition-all" style={{ width: `${eyeBreakProgress * 100}%` }} />
                </div>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">ocular fatigue level</div>
            </div>

            {/* KPI 3: Movement Break progress */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.1)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-theme-purple" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Stretches</span>
                </div>
                {movementBreakDue && (
                  <button 
                    onClick={resetMovementBreak}
                    className="h-6 px-2 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/20 hover:bg-purple-500/30"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-col z-10">
                <span className="font-rounded text-2xl font-bold text-white">{Math.round(movementBreakProgress * 100)}%</span>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-theme-purple rounded-full transition-all" style={{ width: `${movementBreakProgress * 100}%` }} />
                </div>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">to 5-minute break</div>
            </div>

            {/* KPI 4: Hydration metrics */}
            <div 
              className="custom-glass-card p-4 rounded-[18px] flex flex-col justify-between h-[150px] relative"
              style={{
                borderImage: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
                background: 'var(--theme-card-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(239,68,68,0.1)_0%,rgba(0,0,0,0)_70%)]" />
              <div className="flex items-center justify-between text-theme-text-secondary z-10">
                <div className="flex items-center gap-2">
                  <Droplets size={16} className="text-theme-red" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Hydration</span>
                </div>
                <div className="h-7 w-7 rounded-full border border-white/8 flex items-center justify-center text-white">
                  <ArrowUpRight size={13} className="text-theme-red" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2 z-10">
                <span className="font-rounded text-2xl font-bold text-white">{waterIntakeMl} ml</span>
                <span className="text-[9px] text-theme-text-secondary">/ {dailyGoal}</span>
              </div>
              <div className="text-[9px] text-theme-text-tertiary mt-0.5 z-10">daily intake tracker</div>
              <div className="absolute bottom-0 left-0 right-0 h-[38px] pointer-events-none opacity-70">
                <svg className="w-full h-full">
                  <path d={waterPaths.fill} fill="rgba(239, 68, 68, 0.06)" />
                  <path d={waterPaths.line} fill="transparent" stroke="rgb(239, 68, 68)" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </section>

          {/* Row 2: Charts, Actions & Alerts */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Steps & Hydration Waveform Graph */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="custom-glass-card p-5 rounded-[20px] flex flex-col h-[320px] relative w-full">
                <div className="flex items-start justify-between z-10">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold text-white tracking-wide font-rounded">
                      Wellness Overview
                    </h2>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-2.5 rounded-[2px] bg-cyan-400" />
                        <span className="text-[11px] font-medium text-white">Hydration ({waterIntakeMl} ml)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-2.5 rounded-[2px] bg-emerald-500" />
                        <span className="text-[11px] font-medium text-white">Steps ({stepsToday} steps)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 relative mt-4">
                  {/* Wave Graph representation */}
                  <svg className="w-full h-full">
                    <path d={waterPaths.fill} fill="rgba(6, 182, 212, 0.08)" />
                    <path d={waterPaths.line} fill="transparent" stroke="rgb(6, 182, 212)" strokeWidth="2" />
                    
                    <path d={stepsPaths.fill} fill="rgba(16, 185, 129, 0.08)" />
                    <path d={stepsPaths.line} fill="transparent" stroke="rgb(16, 185, 129)" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Quick Actions Hub */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="custom-glass-card p-4 rounded-[20px] flex flex-col gap-3 h-[180px] w-full">
                <div className="flex items-center gap-2 text-theme-text-secondary">
                  <Heart size={18} className="text-theme-accent" />
                  <span className="text-xs font-semibold uppercase tracking-wider font-rounded">Quick Actions</span>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addWater(250)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
                    >
                      <Droplets size={14} />
                      +250ml
                    </button>
                    <button
                      onClick={() => addWater(500)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
                    >
                      <Droplets size={14} />
                      +500ml
                    </button>
                  </div>
                  <button
                    onClick={() => addSteps(100)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    <Activity size={14} />
                    +100 steps
                  </button>
                </div>
              </div>

              {/* Steps progress rings */}
              <div className="custom-glass-card p-4 rounded-[20px] flex-1 min-h-[120px] flex flex-col justify-between">
                <div className="flex items-center justify-between text-theme-text-secondary">
                  <span className="text-xs font-semibold uppercase tracking-wider font-rounded">Steps Today</span>
                  <span className="text-[10px] text-white font-mono">{stepsToday} / 10,000</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="relative h-14 w-14 flex items-center justify-center">
                    <svg className="h-full w-full transform -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="transparent" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="transparent" stroke="var(--theme-accent)" strokeWidth="4" strokeDasharray={150} strokeDashoffset={150 - (stepsProgress * 150)} className="transition-all duration-500" />
                    </svg>
                    <span className="absolute text-[9px] font-bold text-white">{Math.round(stepsProgress * 100)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Daily Steps</span>
                    <span className="text-[10px] text-theme-text-secondary">to healthy standard target</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings and Alerts overlay */}
            <div className="lg:col-span-2 flex">
              <div className="custom-glass-card p-4 rounded-[20px] flex flex-col justify-between h-[320px] w-full">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-secondary font-rounded">Ergonomic Alerts</span>
                  
                  {(eyeBreakDue || movementBreakDue) ? (
                    <div className="flex flex-col gap-3 mt-4">
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex flex-col gap-1.5 animate-pulse">
                        <span className="text-xs font-bold">Break Recommended!</span>
                        <span className="text-[9px] leading-snug">
                          {eyeBreakDue && '20-20-20 eye refresh break is due.'}
                          {movementBreakDue && ' 5-minute desktop mobility break is due.'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {eyeBreakDue && (
                          <button
                            onClick={() => { resetEyeBreak(); setBreakActive(true); }}
                            className="w-full py-2 rounded-lg bg-theme-accent text-black text-[11px] font-bold hover:opacity-90 cursor-pointer"
                          >
                            Start Eye Break
                          </button>
                        )}
                        {movementBreakDue && (
                          <button
                            onClick={() => { resetMovementBreak(); setBreakActive(true); }}
                            className="w-full py-2 rounded-lg bg-theme-accent text-black text-[11px] font-bold hover:opacity-90 cursor-pointer"
                          >
                            Start Move Break
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col items-center justify-center text-center gap-2">
                      <Heart size={36} className="text-emerald-400 opacity-60" />
                      <span className="text-xs font-semibold text-white mt-2">All Status Normal</span>
                      <span className="text-[10px] text-theme-text-tertiary max-w-[120px] leading-snug">Stay active and hydrated for consistent health</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Row 3: Wellness activities logs */}
          <section className="flex">
            <div className="custom-glass-card p-5 rounded-[20px] w-full flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-base font-semibold text-white tracking-wide font-rounded">
                  Wellness Activity Logs
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <Search size={13} className="absolute left-3 text-theme-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Search activity..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-[160px] sm:w-[200px] bg-white/5 border border-white/8 rounded-full text-xs text-white focus:outline-none focus:border-theme-accent"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-theme-text-tertiary uppercase tracking-wider font-semibold border-b border-white/8">
                      <th className="py-2.5 px-3">Log ID</th>
                      <th className="py-2.5 px-3">Action logged</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Increment Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWellnessLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-theme-text-tertiary">No logs recorded</td>
                      </tr>
                    ) : (
                      filteredWellnessLogs.map((log) => (
                        <tr key={log.id} className="border-b border-white/5 hover:bg-white/3 transition">
                          <td className="py-2.5 px-3 font-mono text-white">{log.id}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{log.action}</td>
                          <td className="py-2.5 px-3 text-theme-text-secondary">{log.time}</td>
                          <td className="py-2.5 px-3 font-medium text-white">{log.amount}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${log.color}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button className="h-6 w-6 rounded flex items-center justify-center hover:bg-white/10 text-theme-text-secondary hover:text-white transition">
                              <MoreVertical size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'cleaner' && (
        <div className="flex flex-col gap-6">
          <ScanningPanel />
          <div className="border-t border-white/5 my-2" />
          <ClipboardShield />
          <div className="border-t border-white/5 my-2" />
          <UsbShield />
          <div className="border-t border-white/5 my-2" />
          <SandboxPanel />
        </div>
      )}

      {/* Render Settings config modal overlay */}
      {isSettingsOpen && (
        <SettingsGear onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
