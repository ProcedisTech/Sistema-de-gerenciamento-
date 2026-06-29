import React, { useState, useEffect, useRef } from 'react';

export default function AsyncAutocomplete({
  label,
  placeholder,
  fetchUrl,
  onSelect,
  displayField = 'nome',
  valueField = 'id',
  minChars = 3
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  // Efeito de debounce
  useEffect(() => {
    if (query.length < minChars) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchData(query);
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchData = async (searchTerm) => {
    setLoading(true);
    try {
      const response = await fetch(`${fetchUrl}?search=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      // Ajuste caso a API retorne objeto paginado do Spring (data.content)
      const list = data.content ? data.content : data;
      setResults(list);
      setIsOpen(true);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    setQuery(item[displayField]);
    setIsOpen(false);
    if (onSelect) onSelect(item);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder || 'Digite para buscar...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <span className="text-gray-400 text-sm">Buscando...</span>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((item, index) => (
            <li
              key={item[valueField] || index}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
              onClick={() => handleSelect(item)}
            >
              {item[displayField]}
              {item.codigo && <span className="ml-2 text-gray-500 text-xs">({item.codigo})</span>}
            </li>
          ))}
        </ul>
      )}
      
      {isOpen && !loading && results.length === 0 && query.length >= minChars && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500 text-center">
          Nenhum resultado encontrado.
        </div>
      )}
    </div>
  );
}
