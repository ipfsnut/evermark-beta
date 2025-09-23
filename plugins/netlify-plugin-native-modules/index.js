// Netlify Build Plugin to handle native Node.js modules
// This ensures secp256k1 and keccak are properly compiled for Lambda

module.exports = {
  onPreBuild: async ({ utils }) => {
    console.log('Installing native dependencies for Lambda environment...');
    
    try {
      // Install native modules in the functions directory
      await utils.run.command('npm install secp256k1 keccak', {
        cwd: process.env.NETLIFY_FUNCTIONS_DIR || 'netlify/functions'
      });
      
      console.log('✅ Native modules installed successfully');
    } catch (error) {
      console.error('Failed to install native modules:', error);
      throw error;
    }
  },
  
  onBuild: async ({ utils }) => {
    console.log('Rebuilding native modules for Lambda architecture...');
    
    try {
      // Rebuild for Lambda's architecture
      await utils.run.command('npm rebuild secp256k1 keccak', {
        cwd: process.env.NETLIFY_FUNCTIONS_DIR || 'netlify/functions'
      });
      
      console.log('✅ Native modules rebuilt for Lambda');
    } catch (error) {
      console.error('Failed to rebuild native modules:', error);
      throw error;
    }
  }
};