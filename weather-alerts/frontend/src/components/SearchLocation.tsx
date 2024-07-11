import React, { useState } from 'react';
import '../styles/SearchLocation.css';

const SearchLocation: React.FC = () => {
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  const handleLatitudeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLatitude(event.target.value);
  };

  const handleLongitudeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLongitude(event.target.value);
  };

  const handleSearch = () => {
    alert(`Searching for Latitude: ${latitude}, Longitude: ${longitude}`);
    // Add your search logic here
  };

  return (
    <div className="search-location">
      <h2>Search Location</h2>
      <div className="input-group">
        <label htmlFor="latitude">Latitude:</label>
        <input
          type="text"
          id="latitude"
          value={latitude}
          onChange={handleLatitudeChange}
          pattern="^-?\d{1,2}\.\d+$"
          required
        />
      </div>
      <div className="input-group">
        <label htmlFor="longitude">Longitude:</label>
        <input
          type="text"
          id="longitude"
          value={longitude}
          onChange={handleLongitudeChange}
          pattern="^-?\d{1,3}\.\d+$"
          required
        />
      </div>
      <button onClick={handleSearch}>Search</button>
    </div>
  );
};

export default SearchLocation;
