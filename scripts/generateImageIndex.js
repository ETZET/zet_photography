import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const imagesRoot = join(__dirname, '../public/images');

// Function to get all image files from a directory
const getImageFiles = (dirPath) => {
  return readdirSync(dirPath)
    .filter(file => {
      const ext = extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    });
};

// Generate index.json for each subdirectory
const generateIndexFiles = () => {
  const directories = readdirSync(imagesRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  directories.forEach(dir => {
    const dirPath = join(imagesRoot, dir);
    const images = getImageFiles(dirPath);
    const indexPath = join(dirPath, 'index.json');
    writeFileSync(indexPath, JSON.stringify(images, null, 2));
    console.log(`Generated index.json for ${dir} with ${images.length} images`);
  });
};

generateIndexFiles();