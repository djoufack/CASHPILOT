import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect - A searchable dropdown component
 * Simple implementation with dynamic filtering as you type
 *
 * @param {Array} options - Array of {value, label} objects
 * @param {string} value - Currently selected value
 * @param {function} onValueChange - Callback when value changes
 * @param {string} placeholder - Placeholder text
 * @param {string} searchPlaceholder - Search input placeholder
 * @param {string} emptyMessage - Message when no results found
 * @param {string} className - Additional CSS classes
 */
export function SearchableSelect({
  options = [],
  value,
  onValueChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucun résultat.",
  className,
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearchQuery("");
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when opening
      setTimeout(() => inputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelect = (optionValue) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearchQuery("");
  };

  const handleToggle = () => {
    setOpen(!open);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
          "bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800",
          !value && "text-gray-500",
          className
        )}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-700 bg-gray-800 shadow-lg">
          {/* Search input */}
          <div className="flex items-center border-b border-gray-700 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-8 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="ml-2 p-1 hover:bg-gray-700 rounded text-gray-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors text-left",
                    "hover:bg-gray-700 text-white",
                    value === option.value && "bg-gray-700/50"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
