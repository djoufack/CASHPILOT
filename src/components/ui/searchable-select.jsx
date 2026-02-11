import React, { useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect - A searchable dropdown component
 * Allows typing to filter options for quick selection
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

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (optionValue) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearchQuery("");
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 hover:text-white",
            !value && "text-gray-500",
            className
          )}
        >
          <span className="truncate text-left">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-gray-800 border-gray-700"
        align="start"
        sideOffset={4}
      >
        <div className="bg-gray-800 text-white">
          {/* Search input */}
          <div className="flex items-center border-b border-gray-700 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-8 bg-transparent text-sm outline-none placeholder:text-gray-500"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="ml-2 p-1 hover:bg-gray-700 rounded"
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
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                    "hover:bg-gray-700 focus:bg-gray-700",
                    value === option.value && "bg-gray-700/50"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
