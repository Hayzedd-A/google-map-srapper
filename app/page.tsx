"use client";

import { useState, useEffect, useCallback } from "react";
import { searchAndSave, searchWithAutomation, checkAutomationStatus } from "./actions";
import { Country, State, City, ICountry, IState, ICity } from "country-state-city";

export default function Home() {
  const [keyword, setKeyword] = useState("");

  const [countries, setCountries] = useState<ICountry[]>([]);
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);

  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [cityType, setCityType] = useState<"pre-filled" | "manual">(
    "pre-filled",
  );

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState("");
  const [override, setOverride] = useState(false);
  const [queryExists, setQueryExists] = useState(false);
  const [queryStatus, setQueryStatus] = useState<string | undefined>();
  const [resumedFrom, setResumedFrom] = useState<number | undefined>();

  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  // Check query status when search parameters change
  const checkQueryStatusFn = useCallback(async () => {
    if (!keyword.trim() || !selectedCountry || !selectedState) {
      setQueryExists(false);
      setQueryStatus(undefined);
      setResumedFrom(undefined);
      return;
    }

    try {
      const countryName =
        Country.getCountryByCode(selectedCountry)?.name || selectedCountry;
      const stateName =
        State.getStateByCodeAndCountry(selectedState, selectedCountry)?.name ||
        selectedState;

      const isAutomation = selectedCity === "ALL";
      const result = await checkAutomationStatus(
        keyword,
        countryName,
        stateName
      );

      setQueryExists(result.exists);
      setQueryStatus(result.status);
      
      if (result.exists && result.progressIndex && result.progressIndex > 0) {
        setResumedFrom(result.progressIndex);
      } else {
        setResumedFrom(undefined);
      }
    } catch (error) {
      console.error("Failed to check query status:", error);
    }
  }, [keyword, selectedCountry, selectedState, selectedCity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkQueryStatusFn();
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [checkQueryStatusFn]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryCode = e.target.value;
    setSelectedCountry(countryCode);
    setStates(State.getStatesOfCountry(countryCode));
    setSelectedState("");
    setCities([]);
    setSelectedCity("");
    setOverride(false);
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stateCode = e.target.value;
    setSelectedState(stateCode);
    const stateCities = City.getCitiesOfState(selectedCountry, stateCode);
    setCities(stateCities);
    setSelectedCity("");
    setOverride(false);
  };

  const handleCityChange = (city: string) => {
    setOverride(false);
    if (city === "__manual-input__") {
      setCityType("manual");
      setSelectedCity("")
    } 
    else if (city === "__pre-filled__") setCityType("pre-filled");
    else setSelectedCity(city);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !selectedCountry || !selectedState) {
      setStatus("Error: Keyword, Country, and State are required.");
      return;
    }

    setLoading(true);
    setStatus("Starting...");
    setProgress("");
    setResumedFrom(undefined);

    const countryName =
      Country.getCountryByCode(selectedCountry)?.name || selectedCountry;
    const stateName =
      State.getStateByCodeAndCountry(selectedState, selectedCountry)?.name ||
      selectedState;

    try {
      if (selectedCity === "ALL") {
        // Automation Mode: Loop through all cities
        const citiesToSearch = cities;
        let totalAdded = 0;
        let totalFound = 0;

        const statusMessage = queryExists 
          ? `Resuming automation for ${citiesToSearch.length} cities in ${stateName}, ${countryName}...`
          : `Starting automation for ${citiesToSearch.length} cities in ${stateName}, ${countryName}...`;
        
        setStatus(statusMessage);

        for (let i = 0; i < citiesToSearch.length; i++) {
          const city = citiesToSearch[i];
          const cityName = city.name;

          setProgress(
            `Processing city ${i + 1}/${citiesToSearch.length}: ${cityName}`,
          );

          try {
            const result = await searchAndSave(
              keyword,
              countryName,
              stateName,
              cityName,
              override,
            );
            if (result.success) {
              totalFound += result?.count || 0;
              totalAdded += result?.stats?.added || 0;
            }
          } catch (err) {
            console.error(`Failed to search for ${cityName}`, err);
          }

          // Small delay to be nice to the server/API
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        setStatus(
          `Automation Complete! Found ${totalFound} results. Added ${totalAdded} new entries to spreadsheet.`,
        );
        setProgress("");
      } else {
        // Single City Mode
        const cityName = selectedCity || ""; // If empty, it might just search state/country depending on logic, but let's assume specific city if selected

        // If no city selected but not ALL, maybe warn? Or just search state?
        // For now, if no city selected, we pass empty string, backend handles it as "Keyword in State, Country"

        setStatus("Searching Google Maps...");
        const result = await searchAndSave(
          keyword,
          countryName,
          stateName,
          cityName,
          override,
        );

        if (result.success) {
          if (result.skipped) {
            setStatus(
              `Query already completed! Found ${result.count} results previously.`,
            );
          } else {
            setStatus(
              `Success! Found ${result.count} results. Added ${result.stats?.added} new entries to spreadsheet.`,
            );
          }
        } else {
          setStatus(`Error: ${result.error}`);
        }
      }
    } catch (err) {
      setStatus("An unexpected error occurred.");
      console.error(err);
    } finally {
      setLoading(false);
      setOverride(false);
    }
  };

  // Get status display text
  const getStatusDisplayText = () => {
    if (!queryExists) return null;
    
    const statusLabels: Record<string, string> = {
      pending: "⏳ Query pending",
      in_progress: "🔄 Query in progress",
      completed: "✅ Query completed",
      failed: "❌ Query failed",
    };
    
    return (
      <span className="text-sm text-blue-600">
        {statusLabels[queryStatus || ""] || `Status: ${queryStatus}`}
        {resumedFrom && ` (resuming from city ${resumedFrom})`}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Google Map Scraper
        </h1>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label
              htmlFor="keyword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Keyword (e.g. Restaurants)
            </label>
            <input
              type="text"
              id="keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. Restaurants"
              className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={loading}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="country"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Country
              </label>
              <select
                id="country"
                value={selectedCountry}
                onChange={handleCountryChange}
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={loading}
                required
              >
                <option value="">Select Country</option>
                {countries.map((country) => (
                  <option key={country.isoCode} value={country.isoCode}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="state"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                State
              </label>
              <select
                id="state"
                value={selectedState}
                onChange={handleStateChange}
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={loading || !selectedCountry}
                required
              >
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state.isoCode} value={state.isoCode}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              City
            </label>
            {cityType === "manual" ? (
              <div className="flex gap-2">
              <input
                id="city"
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={loading || !selectedState}
                required
                />
                <button 
                  type="button"
                  className="whitespace-nowrap py-3 px-4 rounded-lg text-white font-medium transition-colors bg-blue-600 hover:bg-blue-700 active:bg-blue-800" 
                  onClick={() => handleCityChange("__pre-filled__")}
                >
                  Use prefilled
                </button>
                </div>
            ) : (
              <select
                id="city"
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={loading || !selectedState}
              >
                <option value="">Select City (Optional)</option>
                <option value="__manual-input__">Input Manual</option>
                {cities.length > 0 && (
                  <option value="ALL" className="font-bold text-blue-600">
                    -- ALL CITIES (Automation) --
                  </option>
                )}
                {cities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Query Status Indicator */}
          {getStatusDisplayText()}

          {/* Override Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="override"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              disabled={loading}
            />
            <label
              htmlFor="override"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              Override previous query (re-run search)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {loading ? "Processing..." : "Start Scraping"}
          </button>
        </form>

        {(status || progress) && (
          <div
            className={`mt-6 p-4 rounded-lg text-sm ${
              status.startsWith("Error")
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            <div className="font-medium">{status}</div>
            {progress && (
              <div className="mt-1 text-xs opacity-80">{progress}</div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Results</h2>
          <a
            href="/api/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            Download Spreadsheet (.xlsx)
          </a>
        </div>
      </div>
    </div>
  );
}
