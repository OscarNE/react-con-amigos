import React from 'react';
import './App.css';
import Header from './components/Header';
import WeatherIcons from './components/WeatherIcons';
import SearchLocation from './components/SearchLocation';

const App: React.FC = () => {
  return (
    <div className="App">
      <Header />
      <WeatherIcons />
      <SearchLocation />
    </div>
  );
};

export default App;
