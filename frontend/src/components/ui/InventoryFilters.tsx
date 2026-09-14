import { useState, useEffect, useRef } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import type { InventoryFilters as APIFilters } from '../../services/api/inventory';

interface InventoryFiltersProps {
  onFiltersChange: (filters: APIFilters) => void;
  showLocationFilter?: boolean;
  showResourceTypeFilter?: boolean;
}

export function InventoryFilters({ onFiltersChange, showLocationFilter = false, showResourceTypeFilter = false }: InventoryFiltersProps) {
  const [search, setSearch] = useState('');
  const [billableOnly, setBillableOnly] = useState(false);
  const [billability, setBillability] = useState('');
  const [taggingScope, setTaggingScope] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [location, setLocation] = useState('');
  
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce search and emit changes
  useEffect(() => {
    const handler = setTimeout(() => {
      onFiltersChange({
        search: search || undefined,
        billable_only: billableOnly || undefined,
        billability: billability || undefined,
        tagging_scope: taggingScope || undefined,
        resource_type: resourceType || undefined,
        location: location || undefined
      });
    }, 300);

    return () => clearTimeout(handler);
  }, [search, billableOnly, billability, taggingScope, resourceType, location, onFiltersChange]);

  const clearFilters = () => {
    setBillability('');
    setTaggingScope('');
    setResourceType('');
    setLocation('');
    setShowPopover(false);
  };

  const activeFilterCount = [billability, taggingScope, resourceType, location].filter(Boolean).length;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
      <div className="flex gap-4 flex-1 w-full max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search..."
            className="pl-10 bg-gray-50/50 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="relative" ref={popoverRef}>
          <Button 
            variant="outline" 
            className={`gap-2 ${activeFilterCount > 0 ? 'border-primary text-primary bg-primary/5' : 'text-gray-600'}`}
            onClick={() => setShowPopover(!showPopover)}
          >
            <Filter size={16} /> 
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {showPopover && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 shadow-lg rounded-lg z-50 p-4">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-sm">Filters</h3>
                <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">
                  <X size={12} /> Clear all
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Billability</label>
                  <select 
                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary p-2 border"
                    value={billability}
                    onChange={(e) => setBillability(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="BILLABLE">BILLABLE</option>
                    <option value="NON_BILLABLE">NON_BILLABLE</option>
                    <option value="CONDITIONAL">CONDITIONAL</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tagging Scope</label>
                  <select 
                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary p-2 border"
                    value={taggingScope}
                    onChange={(e) => setTaggingScope(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="REQUIRED">REQUIRED</option>
                    <option value="SUPPORTING">SUPPORTING</option>
                    <option value="EXCLUDED">EXCLUDED</option>
                  </select>
                </div>
                
                {showResourceTypeFilter && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Resource Type (exact)</label>
                    <Input 
                      className="text-sm p-2 w-full"
                      value={resourceType}
                      onChange={(e) => setResourceType(e.target.value)}
                      placeholder="e.g. ec2/instance"
                    />
                  </div>
                )}
                
                {showLocationFilter && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Location / Region (exact)</label>
                    <Input 
                      className="text-sm p-2 w-full"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. us-east-1"
                    />
                  </div>
                )}

                <Button className="w-full mt-4" onClick={() => setShowPopover(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2 bg-white whitespace-nowrap shadow-sm">
        <input 
          type="checkbox" 
          id="billable-toggle" 
          className="rounded text-primary focus:ring-primary h-4 w-4"
          checked={billableOnly}
          onChange={(e) => setBillableOnly(e.target.checked)}
        />
        <label htmlFor="billable-toggle" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
          Billable Resources Only
        </label>
      </div>
    </div>
  );
}
