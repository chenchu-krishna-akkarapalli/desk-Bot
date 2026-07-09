import { useState, useMemo } from 'react';
import { 
  FolderOpen, FolderPlus, Trash2, RefreshCw, Search, Play, Database, FileText,
  FileCode, FileSpreadsheet, FileImage, FileAudio, Terminal
} from 'lucide-react';
import { useWorkspaceCleaner, WorkspaceFile } from '../../hooks/useWorkspaceCleaner';
import RiskModal from './RiskModal';
import DeletionLoader from './DeletionLoader';

export default function ScanningPanel() {
  const {
    scanPaths,
    activeMode,
    categories,
    isScanning,
    scanResults,
    selectedFiles,
    isDeleting,
    statusMessage,
    removeScanPath,
    toggleCategory,
    setActiveMode,
    startScan,
    setSelectedFiles,
    deleteSelectedFiles,
    clearResults,
    browseAndAddPath,
    totalReclaimedBytes
  } = useWorkspaceCleaner();

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'safe' | 'medium' | 'high'>('all');

  // Dialog State
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [filesToConfirm, setFilesToConfirm] = useState<WorkspaceFile[]>([]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRiskColor = (level: string) => {
    if (level === 'high') return 'text-red-400 font-bold';
    if (level === 'medium') return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getRiskLabel = (level: string) => {
    if (level === 'high') return 'HIGH (RISK)';
    if (level === 'medium') return 'MEDIUM';
    return 'LOW';
  };

  // Helper categories config
  const categoryConfig = [
    { id: 'markdown', label: 'Markdown Docs (.md)' },
    { id: 'data', label: 'Spreadsheets & Data (.xlsx, .json, .csv)' },
    { id: 'documents', label: 'Standard Documents (.pdf, .txt)' },
    { id: 'visual', label: 'Visual Media (.png, .jpg, .webp)' },
    { id: 'media', label: 'Audio/Video (.mp3, .mp4)' },
    { id: 'binaries', label: 'Executables (.exe, .bat)' }
  ];

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'markdown':
        return { icon: FileCode, label: 'Markdown', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
      case 'data':
        return { icon: FileSpreadsheet, label: 'Data', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' };
      case 'documents':
        return { icon: FileText, label: 'Document', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
      case 'visual':
        return { icon: FileImage, label: 'Visual', color: 'bg-pink-500/10 text-pink-400 border border-pink-500/20' };
      case 'media':
        return { icon: FileAudio, label: 'Media', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' };
      case 'binaries':
        return { icon: Terminal, label: 'Binary', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
      case 'build_artifact':
        return { icon: Database, label: 'Build Artifact', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
      default:
        return { icon: FileText, label: cat, color: 'bg-white/5 text-theme-text-secondary border border-white/5' };
    }
  };

  // Filter scan results based on risk score, category, and search query
  const filteredResults = useMemo(() => {
    return scanResults.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.path.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRisk = 
        riskFilter === 'all' ||
        (riskFilter === 'safe' && item.risk_level === 'low') ||
        (riskFilter === 'medium' && item.risk_level === 'medium') ||
        (riskFilter === 'high' && item.risk_level === 'high');

      const matchesCategory = 
        activeMode !== 'files' ||
        categories.includes(item.category);

      return matchesSearch && matchesRisk && matchesCategory;
    });
  }, [scanResults, searchQuery, riskFilter, categories, activeMode]);

  // Handle Deletion Trigger
  const handleDeleteTrigger = () => {
    const selectedList = scanResults.filter(r => selectedFiles.includes(r.path));
    
    // Check if any selected file is system-protected, environment file, or high-risk
    const highRiskItems = selectedList.filter(
      item => item.is_system_file || item.risk_level === 'high'
    );

    if (highRiskItems.length > 0) {
      setFilesToConfirm(highRiskItems);
      setIsRiskModalOpen(true);
    } else {
      deleteSelectedFiles();
    }
  };

  const handleConfirmHighRiskDelete = () => {
    setIsRiskModalOpen(false);
    deleteSelectedFiles();
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Risk Confirmation Intercept Modal */}
      <RiskModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        onConfirm={handleConfirmHighRiskDelete}
        affectedFiles={filesToConfirm}
      />

      {/* Bulk Deletion Overlay Loader */}
      <DeletionLoader />

      {/* Mode Switch Tabs */}
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full p-1 self-start select-none z-10">
        <button
          onClick={() => setActiveMode('workspace')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeMode === 'workspace'
              ? 'bg-theme-accent text-black shadow-md font-extrabold'
              : 'text-theme-text-secondary hover:text-white'
          }`}
        >
          <FolderOpen size={13} />
          Target Workspace Folder
        </button>
        <button
          onClick={() => setActiveMode('files')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeMode === 'files'
              ? 'bg-theme-accent text-black shadow-md font-extrabold'
              : 'text-theme-text-secondary hover:text-white'
          }`}
        >
          <FileText size={13} />
          Target Files
        </button>
      </div>

      {/* Row 1: Configurations & Space Reclaimed Summary Card */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Workspace Directories Selection */}
        <div 
          className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-2"
          style={{
            borderImage: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
            background: 'var(--theme-card-bg)'
          }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(6, 182, 212, 0.06)_0%,rgba(0,0,0,0)_70%)]" />
          <div className="z-10 flex flex-col gap-3">
            <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <FolderOpen size={16} className="text-theme-cyan" />
              Target Directories
            </h3>
            
            {/* Conditional Descriptions */}
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              {activeMode === 'workspace' ? (
                "Select a directory containing your software projects. DeskWell will scan for stale build folders (node_modules, target, build) and configuration files (.env) to help you reclaim disk space."
              ) : (
                "Select target directories and filter matches by document category to clean up specific file types recursively throughout the folder hierarchy."
              )}
            </p>

            {/* List of folders */}
            <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto mt-1">
              {scanPaths.length === 0 ? (
                <div className="border border-white/5 bg-black/20 rounded-lg p-3 text-center text-xs text-theme-text-tertiary">
                  No directory targets added yet. Click Add Folder to choose paths.
                </div>
              ) : (
                scanPaths.map((path) => (
                  <div key={path} className="flex items-center justify-between bg-black/40 border border-white/8 rounded-lg p-2 font-mono text-[10px] text-white">
                    <span className="truncate pr-4 flex-1">{path}</span>
                    <button
                      onClick={() => removeScanPath(path)}
                      className="text-red-400 hover:text-red-300 font-bold px-1.5 py-0.5 rounded hover:bg-white/5 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-1">
              <button
                onClick={browseAndAddPath}
                className="px-4 py-2 text-xs rounded-full font-bold bg-white/10 border border-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <FolderPlus size={13} className="text-theme-cyan" />
                Add Folder
              </button>

              <button
                onClick={startScan}
                disabled={scanPaths.length === 0 || isScanning}
                className="px-5 py-2 text-xs rounded-full font-bold bg-theme-accent text-black hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-theme-accent/10 shrink-0"
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play size={12} fill="black" />
                    Scan Directory
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Space Reclaimed Card */}
        <div 
          className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-1"
          style={{
            borderImage: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
            background: 'var(--theme-card-bg)'
          }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.08)_0%,rgba(0,0,0,0)_70%)]" />
          <div className="flex flex-col gap-3 z-10">
            <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Trash2 size={16} className="text-theme-yellow" />
              Space Reclaimed
            </h3>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-theme-text-tertiary uppercase font-semibold">Total Selected Size</span>
                <span className="text-2xl font-extrabold text-white leading-tight mt-0.5 font-mono">
                  {formatBytes(
                    scanResults
                      .filter((r) => selectedFiles.includes(r.path))
                      .reduce((acc, curr) => acc + curr.size_bytes, 0)
                  )}
                </span>
              </div>

              {totalReclaimedBytes > 0 && (
                <div className="flex flex-col border-t border-white/5 pt-2 animate-fade-in">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1 select-none">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Session Reclaimed Space
                  </span>
                  <span className="text-lg font-bold text-white leading-tight mt-0.5 font-mono">
                    {formatBytes(totalReclaimedBytes)}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1 border-t border-white/5 pt-3">
              <div className="flex flex-col">
                <span className="text-[9px] text-theme-text-tertiary uppercase font-semibold">Selected Items</span>
                <span className="text-sm font-bold text-white mt-0.5 font-mono">
                  {selectedFiles.length} / {scanResults.length}
                </span>
              </div>
              <div className="flex flex-col font-mono">
                <span className="text-[9px] text-theme-text-tertiary uppercase font-semibold">Max Risk Selected</span>
                <span className={`text-xs font-bold mt-0.5 uppercase ${
                  selectedFiles.length === 0
                    ? 'text-theme-text-secondary'
                    : scanResults.some((r) => selectedFiles.includes(r.path) && r.risk_level === 'high')
                      ? 'text-rose-400 font-extrabold animate-pulse'
                      : scanResults.some((r) => selectedFiles.includes(r.path) && r.risk_level === 'medium')
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                }`}>
                  {selectedFiles.length === 0
                    ? 'N/A'
                    : scanResults.some((r) => selectedFiles.includes(r.path) && r.risk_level === 'high')
                      ? 'HIGH'
                      : scanResults.some((r) => selectedFiles.includes(r.path) && r.risk_level === 'medium')
                        ? 'MEDIUM'
                        : 'LOW'}
                </span>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDeleteTrigger}
            disabled={selectedFiles.length === 0 || isDeleting}
            className="mt-4 w-full py-2 rounded-lg font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center gap-1.5 z-10 shrink-0"
          >
            <Trash2 size={13} />
            Purge Selected
          </button>
        </div>
      </section>

      {/* Row 2: Status Message */}
      {statusMessage && (
        <div className="bg-black/35 border border-white/8 rounded-xl p-3.5 font-mono text-[10px] text-white">
          <span className="text-theme-text-secondary truncate block">{statusMessage}</span>
        </div>
      )}

      {/* Row 3: Results List Table */}
      <section className="flex-1 min-h-[350px]">
        <div 
          className="custom-glass-card h-full p-5 rounded-[22px] flex flex-col justify-between relative"
          style={{
            borderImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
            background: 'var(--theme-card-bg)'
          }}
        >
          {/* Controls header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col">
              <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase">
                Reclaimable Workspace Items
              </h3>
              <span className="text-[10px] text-theme-text-tertiary">
                Select items to delete. System elements and config files require confirmation override.
              </span>
            </div>

            <div className="flex items-center gap-3 justify-end flex-wrap sm:flex-nowrap">
              {/* Search */}
              <div className="relative flex items-center bg-black/40 border border-white/8 rounded-full px-2.5 py-1 text-xs">
                <Search size={12} className="text-theme-text-secondary mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter scanned..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-white text-[10px] w-[120px] focus:outline-none placeholder-white/20"
                />
              </div>

              {/* Risk filters */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-full p-0.5">
                {(['all', 'safe', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setRiskFilter(lvl)}
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition cursor-pointer ${
                      riskFilter === lvl
                        ? 'bg-theme-cyan text-black shadow-sm'
                        : 'text-theme-text-secondary hover:text-white'
                    }`}
                  >
                    {lvl === 'all' ? 'All' : lvl === 'safe' ? 'Low' : lvl === 'medium' ? 'Medium' : 'High'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results table */}
          <div className="overflow-y-auto flex-1 min-h-[220px] max-h-[380px] border border-white/5 rounded-xl bg-black/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-theme-text-tertiary uppercase tracking-wider font-semibold border-b border-white/8 bg-white/3 text-[9px] align-middle">
                  <th className="py-2.5 px-3 w-[45px] text-center">
                    <input
                      type="checkbox"
                      checked={filteredResults.length > 0 && filteredResults.every(r => selectedFiles.includes(r.path))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allFilteredPaths = filteredResults.map(r => r.path);
                          setSelectedFiles(Array.from(new Set([...selectedFiles, ...allFilteredPaths])));
                        } else {
                          const filteredPaths = filteredResults.map(r => r.path);
                          setSelectedFiles(selectedFiles.filter(p => !filteredPaths.includes(p)));
                        }
                      }}
                      className="h-3 w-3 rounded border-white/20 bg-black/40 text-theme-cyan focus:ring-0 cursor-pointer accent-theme-cyan"
                    />
                  </th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 min-w-[220px]">
                    <div className="flex flex-col gap-1.5 py-1">
                      <span>Category</span>
                      {activeMode === 'files' && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {categoryConfig.map((cat) => {
                            const isSelected = categories.includes(cat.id);
                            const details = getCategoryDetails(cat.id);
                            const IconComp = details.icon;
                            return (
                              <button
                                key={cat.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCategory(cat.id);
                                }}
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition cursor-pointer flex items-center gap-1.5 select-none ${
                                  isSelected
                                    ? details.color
                                    : 'bg-transparent border-white/5 text-theme-text-tertiary hover:bg-white/3'
                                }`}
                                title={cat.label}
                              >
                                <IconComp size={9} />
                                <span>{details.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3">File Size</th>
                  <th className="py-2.5 px-3">Safety Risk Score</th>
                  <th className="py-2.5 px-3">Absolute Path</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-theme-text-tertiary">
                      {isScanning ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={24} className="animate-spin text-theme-cyan" />
                          <span className="text-xs text-white">Traversing target directories for cleanable items...</span>
                        </div>
                      ) : scanResults.length > 0 ? (
                        'No items match your filters.'
                      ) : (
                        'Add workspace folders above and click "Scan Directory" to check items.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((item) => (
                    <tr key={item.path} className="border-b border-white/5 hover:bg-white/3 transition text-[11px]">
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(item.path)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFiles([...selectedFiles, item.path]);
                            } else {
                              setSelectedFiles(selectedFiles.filter(p => p !== item.path));
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-white/20 bg-black/40 text-theme-cyan focus:ring-0 cursor-pointer accent-theme-cyan"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[150px]" title={item.name}>
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-theme-text-secondary uppercase text-[9px] font-bold">
                        {item.item_type}
                      </td>
                      <td className="py-2.5 px-3">
                        {(() => {
                          const details = getCategoryDetails(item.category);
                          const IconComp = details.icon;
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-1 uppercase ${details.color}`}>
                              <IconComp size={10} />
                              {details.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-theme-text-secondary">
                        {formatBytes(item.size_bytes)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span className={getRiskColor(item.risk_level)}>
                          {getRiskLabel(item.risk_level)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[9px] text-theme-text-tertiary truncate max-w-[200px]" title={item.path}>
                        {item.path}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-[10px] text-theme-text-tertiary">
            <span>Showing {filteredResults.length} of {scanResults.length} items</span>
            {scanResults.length > 0 && (
              <button 
                onClick={clearResults}
                className="text-theme-text-secondary hover:text-white hover:underline transition cursor-pointer bg-transparent border-none p-0"
              >
                Clear list
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
