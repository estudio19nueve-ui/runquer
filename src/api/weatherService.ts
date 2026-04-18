import { Sun, Cloud, CloudRain, CloudLightning, Snowflake, Wind } from 'lucide-react-native';

const API_KEY = '895284fb2d2c1ad3a93d052a49b61312'; // Usando el key genérico de la sesión anterior

export interface WeatherData {
  temperature: number;
  description: string;
  iconName: string;
  Icon: any;
}

export const weatherService = {
  getWeather: async (lat: number, lon: number): Promise<WeatherData | null> => {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      );
      const data = await response.json();
      
      if (data.main) {
        const condition = data.weather[0].main;
        let Icon = Sun;
        
        if (condition === 'Clouds') Icon = Cloud;
        if (condition === 'Rain' || condition === 'Drizzle') Icon = CloudRain;
        if (condition === 'Thunderstorm') Icon = CloudLightning;
        if (condition === 'Snow') Icon = Snowflake;
        if (condition === 'Clear') Icon = Sun;

        return {
          temperature: Math.round(data.main.temp),
          description: data.weather[0].description,
          iconName: condition,
          Icon: Icon
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  }
};
