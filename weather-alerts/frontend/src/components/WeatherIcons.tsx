import React from 'react';
import '../styles/WeatherIcons.css';

import cloudyImg from '../assets/images/cloudy.png';
import rainImg from '../assets/images/rainy.png';
import sunnyImg from '../assets/images/sunny.png';
import snowImg from '../assets/images/snow.png';
import windyImg from '../assets/images/windy.png';

const WeatherIcons: React.FC = () => {
    return (
      <div className="weather-icons">
      <div className="weather-icon">
        <img src={rainImg} alt="Rain" />
        <p>Rain</p>
      </div>
      <div className="weather-icon">
        <img src={sunnyImg} alt="Sunny" />
        <p>Sunny</p>
      </div>
      <div className="weather-icon">
        <img src={cloudyImg} alt="Cloudy" />
        <p>Cloudy</p>
      </div>
      <div className="weather-icon">
        <img src={snowImg} alt="Snow" />
        <p>Snow</p>
      </div>
      <div className="weather-icon">
        <img src={windyImg} alt="Windy" />
        <p>Windy</p>
      </div>
    </div>
    );
  };
export default WeatherIcons;
