// Import all images from the public folder
const seriesConfig = [
  {
    id: 1,
    title: "Flower Decay",
    folderPath: "/images/flowerdecay"
  },
  {
    id: 2,
    title: "Plants Autopsy",
    folderPath: "/images/scanner"
  },
  {
    id: 3,
    title: "Random Iphone Pics",
    folderPath: "/images/iphone"
  }
];

// Function to get all image files from a directory
const getImagesFromDirectory = async (directoryPath) => {
  try {
    const response = await fetch(`${directoryPath}/index.json`);
    if (!response.ok) throw new Error('Failed to fetch image list');
    const imageList = await response.json();
    return imageList.map((filename, index) => ({
      id: index + 1,
      src: `${directoryPath}/${filename}`,
      title: filename.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  } catch (error) {
    console.error(`Error loading images from ${directoryPath}:`, error);
    return [];
  }
};

// Function to initialize all photo series
export const initializePhotoSeries = async () => {
  const series = await Promise.all(
    seriesConfig.map(async (config) => ({
      ...config,
      photos: await getImagesFromDirectory(config.folderPath)
    }))
  );
  return series;
};