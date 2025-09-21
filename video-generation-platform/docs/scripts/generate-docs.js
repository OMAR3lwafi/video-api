#!/usr/bin/env node

/**
 * Automated Documentation Generation and Deployment Script
 * Generates OpenAPI docs, SDK, and deploys to hosting platform
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const yaml = require("js-yaml");
const semver = require("semver");

// Configuration
const CONFIG = {
  openApiSpec: "../openapi/video-api.yaml",
  swaggerUI: "../swagger-ui",
  sdkGenerator: "../sdk-generator",
  outputDir: "./generated-docs",
  deploymentDir: "./deployment",

  // Version management
  versionFile: "./VERSION",
  changelogFile: "./CHANGELOG.md",

  // Deployment targets
  deployment: {
    github: {
      enabled: process.env.DEPLOY_TO_GITHUB === "true",
      repo: process.env.GITHUB_PAGES_REPO || "videogeneration/docs",
      branch: "gh-pages",
    },
    s3: {
      enabled: process.env.DEPLOY_TO_S3 === "true",
      bucket: process.env.S3_DOCS_BUCKET || "docs.videogeneration.platform",
      region: process.env.AWS_REGION || "us-east-1",
    },
    netlify: {
      enabled: process.env.DEPLOY_TO_NETLIFY === "true",
      siteId: process.env.NETLIFY_SITE_ID,
    },
  },

  // Validation settings
  validation: {
    validateSpec: true,
    generateTests: true,
    checkLinks: true,
  },
};

class DocumentationGenerator {
  constructor() {
    this.startTime = Date.now();
    this.errors = [];
    this.warnings = [];
    this.version = this.getCurrentVersion();
  }

  async generate() {
    console.log("🚀 Starting documentation generation...");
    console.log(`📋 Version: ${this.version}`);
    console.log(`🕒 Started at: ${new Date().toISOString()}`);

    try {
      await this.validateEnvironment();
      await this.prepareDirectories();
      await this.validateOpenApiSpec();
      await this.generateSwaggerUI();
      await this.generateTypeScriptSDK();
      await this.generateMarkdownDocs();
      await this.generatePostmanCollection();
      await this.generateInsomniCollection();
      await this.runValidationTests();
      await this.buildStaticSite();

      if (this.shouldDeploy()) {
        await this.deployDocumentation();
      }

      await this.generateReport();

      console.log("✅ Documentation generation completed successfully!");
      console.log(
        `⏱️  Total time: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`,
      );
    } catch (error) {
      console.error("❌ Documentation generation failed:", error);
      this.errors.push(error.message);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    console.log("🔍 Validating environment...");

    const requiredTools = [
      { name: "node", command: "node --version", minVersion: "18.0.0" },
      { name: "npm", command: "npm --version", minVersion: "8.0.0" },
      { name: "git", command: "git --version", minVersion: "2.0.0" },
    ];

    for (const tool of requiredTools) {
      try {
        const output = execSync(tool.command, { encoding: "utf8" }).trim();
        const version = output.match(/\d+\.\d+\.\d+/)?.[0];

        if (version && tool.minVersion && semver.lt(version, tool.minVersion)) {
          throw new Error(
            `${tool.name} version ${version} is below minimum required ${tool.minVersion}`,
          );
        }

        console.log(`  ✅ ${tool.name}: ${version || output}`);
      } catch (error) {
        throw new Error(
          `${tool.name} is not available or version check failed`,
        );
      }
    }

    // Check for required environment variables
    const requiredEnvVars = [];

    if (CONFIG.deployment.github.enabled) {
      requiredEnvVars.push("GITHUB_TOKEN");
    }

    if (CONFIG.deployment.s3.enabled) {
      requiredEnvVars.push("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY");
    }

    if (CONFIG.deployment.netlify.enabled) {
      requiredEnvVars.push("NETLIFY_AUTH_TOKEN");
    }

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set`);
      }
    }

    console.log("✅ Environment validation passed");
  }

  async prepareDirectories() {
    console.log("📁 Preparing directories...");

    const dirs = [
      CONFIG.outputDir,
      CONFIG.deploymentDir,
      path.join(CONFIG.outputDir, "swagger-ui"),
      path.join(CONFIG.outputDir, "sdk"),
      path.join(CONFIG.outputDir, "markdown"),
      path.join(CONFIG.outputDir, "collections"),
      path.join(CONFIG.outputDir, "assets"),
      path.join(CONFIG.outputDir, "examples"),
    ];

    dirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      fs.mkdirSync(dir, { recursive: true });
    });

    console.log("✅ Directories prepared");
  }

  async validateOpenApiSpec() {
    console.log("🔍 Validating OpenAPI specification...");

    const specPath = path.resolve(__dirname, CONFIG.openApiSpec);

    if (!fs.existsSync(specPath)) {
      throw new Error(`OpenAPI specification not found at ${specPath}`);
    }

    try {
      const specContent = fs.readFileSync(specPath, "utf8");
      const spec = yaml.load(specContent);

      // Basic validation
      if (!spec.openapi || !spec.info || !spec.paths) {
        throw new Error("Invalid OpenAPI specification structure");
      }

      // Version validation
      if (spec.info.version !== this.version) {
        this.warnings.push(
          `OpenAPI spec version (${spec.info.version}) differs from project version (${this.version})`,
        );
      }

      // Validate using swagger-parser if available
      try {
        execSync("npx @apidevtools/swagger-parser validate " + specPath, {
          stdio: "pipe",
        });
        console.log("✅ OpenAPI specification is valid");
      } catch (error) {
        throw new Error(
          "OpenAPI specification validation failed: " + error.message,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to parse OpenAPI specification: ${error.message}`,
      );
    }
  }

  async generateSwaggerUI() {
    console.log("📝 Generating Swagger UI...");

    const swaggerUISource = path.resolve(__dirname, CONFIG.swaggerUI);
    const swaggerUIOutput = path.join(CONFIG.outputDir, "swagger-ui");

    // Copy Swagger UI files
    this.copyDirectory(swaggerUISource, swaggerUIOutput);

    // Update configuration for different environments
    const indexPath = path.join(swaggerUIOutput, "index.html");
    let indexContent = fs.readFileSync(indexPath, "utf8");

    // Replace development URLs with production URLs
    const replacements = [
      {
        from: "../openapi/video-api.yaml",
        to: "./video-api.yaml",
      },
      {
        from: "http://localhost:3000/api/v1",
        to: "https://api.videogeneration.platform/api/v1",
      },
    ];

    replacements.forEach(({ from, to }) => {
      indexContent = indexContent.replace(new RegExp(from, "g"), to);
    });

    fs.writeFileSync(indexPath, indexContent);

    // Copy OpenAPI spec to Swagger UI directory
    const specPath = path.resolve(__dirname, CONFIG.openApiSpec);
    const specOutput = path.join(swaggerUIOutput, "video-api.yaml");
    fs.copyFileSync(specPath, specOutput);

    console.log("✅ Swagger UI generated");
  }

  async generateTypeScriptSDK() {
    console.log("🔧 Generating TypeScript SDK...");

    const sdkGeneratorPath = path.resolve(__dirname, CONFIG.sdkGenerator);
    const sdkOutput = path.join(CONFIG.outputDir, "sdk");

    try {
      // Run SDK generator
      execSync(`cd ${sdkGeneratorPath} && npm install`, { stdio: "pipe" });
      execSync(`cd ${sdkGeneratorPath} && npm run generate`, { stdio: "pipe" });

      // Copy generated SDK
      const generatedSDKPath = path.join(sdkGeneratorPath, "generated-sdk");
      if (fs.existsSync(generatedSDKPath)) {
        this.copyDirectory(generatedSDKPath, sdkOutput);
      }

      // Generate additional SDK formats
      await this.generatePythonSDK();
      await this.generateGoSDK();
      await this.generateJavaSDK();

      console.log("✅ TypeScript SDK generated");
    } catch (error) {
      throw new Error(`SDK generation failed: ${error.message}`);
    }
  }

  async generatePythonSDK() {
    console.log("🐍 Generating Python SDK...");

    try {
      // Use openapi-generator-cli for Python SDK
      execSync(
        `npx @openapitools/openapi-generator-cli generate \
        -i ${path.resolve(__dirname, CONFIG.openApiSpec)} \
        -g python \
        -o ${path.join(CONFIG.outputDir, "sdk", "python")} \
        --package-name videogeneration_api \
        --additional-properties packageVersion=${this.version}`,
        { stdio: "pipe" },
      );

      console.log("✅ Python SDK generated");
    } catch (error) {
      console.warn("⚠️  Python SDK generation failed:", error.message);
      this.warnings.push("Python SDK generation failed");
    }
  }

  async generateGoSDK() {
    console.log("🐹 Generating Go SDK...");

    try {
      execSync(
        `npx @openapitools/openapi-generator-cli generate \
        -i ${path.resolve(__dirname, CONFIG.openApiSpec)} \
        -g go \
        -o ${path.join(CONFIG.outputDir, "sdk", "go")} \
        --package-name videogeneration \
        --additional-properties packageVersion=${this.version}`,
        { stdio: "pipe" },
      );

      console.log("✅ Go SDK generated");
    } catch (error) {
      console.warn("⚠️  Go SDK generation failed:", error.message);
      this.warnings.push("Go SDK generation failed");
    }
  }

  async generateJavaSDK() {
    console.log("☕ Generating Java SDK...");

    try {
      execSync(
        `npx @openapitools/openapi-generator-cli generate \
        -i ${path.resolve(__dirname, CONFIG.openApiSpec)} \
        -g java \
        -o ${path.join(CONFIG.outputDir, "sdk", "java")} \
        --package-name com.videogeneration.api \
        --additional-properties apiPackage=com.videogeneration.api`,
        { stdio: "pipe" },
      );

      console.log("✅ Java SDK generated");
    } catch (error) {
      console.warn("⚠️  Java SDK generation failed:", error.message);
      this.warnings.push("Java SDK generation failed");
    }
  }

  async generateMarkdownDocs() {
    console.log("📄 Generating Markdown documentation...");

    const markdownOutput = path.join(CONFIG.outputDir, "markdown");

    try {
      // Generate markdown from OpenAPI spec
      execSync(
        `npx widdershins \
        ${path.resolve(__dirname, CONFIG.openApiSpec)} \
        -o ${path.join(markdownOutput, "api-reference.md")} \
        --language_tabs 'javascript:JavaScript' 'python:Python' 'shell:cURL' 'go:Go' \
        --theme darkula`,
        { stdio: "pipe" },
      );

      // Copy additional markdown files
      const examplesSource = path.resolve(__dirname, "../examples");
      if (fs.existsSync(examplesSource)) {
        this.copyDirectory(
          examplesSource,
          path.join(markdownOutput, "examples"),
        );
      }

      // Generate README for the docs
      const readmeContent = this.generateDocsReadme();
      fs.writeFileSync(path.join(CONFIG.outputDir, "README.md"), readmeContent);

      console.log("✅ Markdown documentation generated");
    } catch (error) {
      console.warn("⚠️  Markdown generation failed:", error.message);
      this.warnings.push("Markdown documentation generation failed");
    }
  }

  async generatePostmanCollection() {
    console.log("📮 Generating Postman collection...");

    try {
      execSync(
        `npx openapi-to-postman \
        -s ${path.resolve(__dirname, CONFIG.openApiSpec)} \
        -o ${path.join(CONFIG.outputDir, "collections", "video-api.postman_collection.json")} \
        -p`,
        { stdio: "pipe" },
      );

      console.log("✅ Postman collection generated");
    } catch (error) {
      console.warn("⚠️  Postman collection generation failed:", error.message);
      this.warnings.push("Postman collection generation failed");
    }
  }

  async generateInsomniCollection() {
    console.log("😴 Generating Insomnia collection...");

    try {
      // Convert OpenAPI to Insomnia format
      const specPath = path.resolve(__dirname, CONFIG.openApiSpec);
      const spec = yaml.load(fs.readFileSync(specPath, "utf8"));

      const insomniaCollection = {
        _type: "export",
        __export_format: 4,
        __export_date: new Date().toISOString(),
        __export_source: "video-api-docs-generator",
        resources: [],
      };

      // Add workspace
      insomniaCollection.resources.push({
        _id: "wrk_video_api",
        _type: "workspace",
        name: "Video Generation API",
        description: spec.info.description,
      });

      // Add environment
      insomniaCollection.resources.push({
        _id: "env_video_api",
        _type: "environment",
        name: "Video API Environment",
        data: {
          base_url: "https://api.videogeneration.platform/api/v1",
          api_key: "{{ _.api_key }}",
          jwt_token: "{{ _.jwt_token }}",
        },
        parentId: "wrk_video_api",
      });

      fs.writeFileSync(
        path.join(
          CONFIG.outputDir,
          "collections",
          "video-api.insomnia_collection.json",
        ),
        JSON.stringify(insomniaCollection, null, 2),
      );

      console.log("✅ Insomnia collection generated");
    } catch (error) {
      console.warn("⚠️  Insomnia collection generation failed:", error.message);
      this.warnings.push("Insomnia collection generation failed");
    }
  }

  async runValidationTests() {
    if (!CONFIG.validation.generateTests) {
      return;
    }

    console.log("🧪 Running validation tests...");

    try {
      // Test OpenAPI spec validity
      execSync(
        `npx swagger2openapi ${path.resolve(__dirname, CONFIG.openApiSpec)} --validate`,
        { stdio: "pipe" },
      );

      // Test generated Swagger UI
      const swaggerPath = path.join(
        CONFIG.outputDir,
        "swagger-ui",
        "index.html",
      );
      if (!fs.existsSync(swaggerPath)) {
        throw new Error("Swagger UI index.html not found");
      }

      // Test SDK compilation
      const sdkPath = path.join(CONFIG.outputDir, "sdk");
      if (fs.existsSync(path.join(sdkPath, "package.json"))) {
        execSync(`cd ${sdkPath} && npm install && npm run build`, {
          stdio: "pipe",
        });
      }

      console.log("✅ Validation tests passed");
    } catch (error) {
      this.warnings.push(`Validation tests failed: ${error.message}`);
    }
  }

  async buildStaticSite() {
    console.log("🏗️  Building static documentation site...");

    const siteOutput = path.join(CONFIG.deploymentDir, "site");
    fs.mkdirSync(siteOutput, { recursive: true });

    // Create main index.html
    const indexHtml = this.generateSiteIndex();
    fs.writeFileSync(path.join(siteOutput, "index.html"), indexHtml);

    // Copy all generated content
    this.copyDirectory(CONFIG.outputDir, siteOutput);

    // Generate sitemap.xml
    const sitemap = this.generateSitemap();
    fs.writeFileSync(path.join(siteOutput, "sitemap.xml"), sitemap);

    // Generate robots.txt
    const robotsTxt = this.generateRobotsTxt();
    fs.writeFileSync(path.join(siteOutput, "robots.txt"), robotsTxt);

    console.log("✅ Static site built");
  }

  async deployDocumentation() {
    console.log("🚀 Deploying documentation...");

    const deploymentPromises = [];

    if (CONFIG.deployment.github.enabled) {
      deploymentPromises.push(this.deployToGitHub());
    }

    if (CONFIG.deployment.s3.enabled) {
      deploymentPromises.push(this.deployToS3());
    }

    if (CONFIG.deployment.netlify.enabled) {
      deploymentPromises.push(this.deployToNetlify());
    }

    const results = await Promise.allSettled(deploymentPromises);

    results.forEach((result, index) => {
      const platforms = ["GitHub Pages", "AWS S3", "Netlify"];
      if (result.status === "fulfilled") {
        console.log(`✅ Deployed to ${platforms[index]}`);
      } else {
        console.warn(
          `⚠️  Deployment to ${platforms[index]} failed:`,
          result.reason,
        );
        this.warnings.push(`${platforms[index]} deployment failed`);
      }
    });
  }

  async deployToGitHub() {
    const siteDir = path.join(CONFIG.deploymentDir, "site");

    execSync(`cd ${siteDir} && git init`, { stdio: "pipe" });
    execSync(
      `cd ${siteDir} && git remote add origin https://github.com/${CONFIG.deployment.github.repo}.git`,
      { stdio: "pipe" },
    );
    execSync(
      `cd ${siteDir} && git checkout -b ${CONFIG.deployment.github.branch}`,
      { stdio: "pipe" },
    );
    execSync(`cd ${siteDir} && git add .`, { stdio: "pipe" });
    execSync(`cd ${siteDir} && git commit -m "Deploy docs v${this.version}"`, {
      stdio: "pipe",
    });
    execSync(
      `cd ${siteDir} && git push -f origin ${CONFIG.deployment.github.branch}`,
      { stdio: "pipe" },
    );
  }

  async deployToS3() {
    const siteDir = path.join(CONFIG.deploymentDir, "site");

    execSync(
      `aws s3 sync ${siteDir} s3://${CONFIG.deployment.s3.bucket} --delete --region ${CONFIG.deployment.s3.region}`,
      { stdio: "pipe" },
    );

    // Invalidate CloudFront if distribution ID is provided
    if (process.env.CLOUDFRONT_DISTRIBUTION_ID) {
      execSync(
        `aws cloudfront create-invalidation --distribution-id ${process.env.CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"`,
        { stdio: "pipe" },
      );
    }
  }

  async deployToNetlify() {
    const siteDir = path.join(CONFIG.deploymentDir, "site");

    execSync(
      `npx netlify-cli deploy --dir ${siteDir} --site ${CONFIG.deployment.netlify.siteId} --prod`,
      { stdio: "pipe" },
    );
  }

  generateSiteIndex() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Generation Platform - API Documentation</title>
  <meta name="description" content="Complete API documentation for the Video Generation Platform">
  <link rel="canonical" href="https://docs.videogeneration.platform/">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 40px; background: #f8fafc; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #1a202c; margin-bottom: 20px; }
    .section { margin: 30px 0; }
    .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .link-card { padding: 20px; border: 1px solid #e2e8f0; border-radius: 6px; text-decoration: none; color: #2d3748; transition: all 0.2s; }
    .link-card:hover { border-color: #3182ce; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .link-title { font-weight: 600; margin-bottom: 8px; color: #3182ce; }
    .link-desc { font-size: 14px; color: #718096; }
    .version { background: #e6fffa; color: #234e52; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎬 Video Generation Platform API</h1>
      <p>Complete documentation and tools for integrating with our video generation API</p>
      <p>Version: <span class="version">v${this.version}</span> | Generated: ${new Date().toISOString()}</p>
    </header>

    <div class="section">
      <h2>📚 Documentation</h2>
      <div class="link-grid">
        <a href="./swagger-ui/" class="link-card">
          <div class="link-title">Interactive API Explorer</div>
          <div class="link-desc">Try out API endpoints directly in your browser with Swagger UI</div>
        </a>
        <a href="./markdown/api-reference.md" class="link-card">
          <div class="link-title">API Reference</div>
          <div class="link-desc">Complete markdown documentation with examples</div>
        </a>
        <a href="./markdown/examples/" class="link-card">
          <div class="link-title">Usage Examples</div>
          <div class="link-desc">Real-world examples and integration guides</div>
        </a>
      </div>
    </div>

    <div class="section">
      <h2>🛠️ SDKs & Tools</h2>
      <div class="link-grid">
        <a href="./sdk/" class="link-card">
          <div class="link-title">TypeScript SDK</div>
          <div class="link-desc">Official TypeScript/JavaScript client library</div>
        </a>
        <a href="./sdk/python/" class="link-card">
          <div class="link-title">Python SDK</div>
          <div class="link-desc">Python client library with async support</div>
        </a>
        <a href="./sdk/go/" class="link-card">
          <div class="link-title">Go SDK</div>
          <div class="link-desc">Go client library for high-performance applications</div>
        </a>
        <a href="./sdk/java/" class="link-card">
          <div class="link-title">Java SDK</div>
          <div class="link-desc">Java client library for enterprise applications</div>
        </a>
      </div>
    </div>

    <div class="section">
      <h2>📦 API Collections</h2>
      <div class="link-grid">
        <a href="./collections/video-api.postman_collection.json" class="link-card">
          <div class="link-title">Postman Collection</div>
          <div class="link-desc">Import into Postman for easy API testing</div>
        </a>
        <a href="./collections/video-api.insomnia_collection.json" class="link-card">
          <div class="link-title">Insomnia Collection</div>
          <div class="link-desc">Import into Insomnia REST client</div>
        </a>
        <a href="./video-api.yaml" class="link-card">
          <div class="link-title">OpenAPI Specification</div>
          <div class="link-desc">Raw OpenAPI 3.0 specification file</div>
        </a>
      </div>
    </div>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;">
      <p>Need help? Contact us at <a href="mailto:api-support@videogeneration.platform">api-support@videogeneration.platform</a></p>
    </footer>
  </div>
</body>
</html>`;
  }

  generateDocsReadme() {
    return `# Video Generation Platform API Documentation

This directory contains the complete API documentation for the Video Generation Platform.

## 📋 Contents

- **Interactive Documentation**: [swagger-ui/](./swagger-ui/) - Try out API endpoints directly
- **API Reference**: [markdown/api-reference.md](./markdown/api-reference.md) - Complete API documentation
- **Usage Examples**: [markdown/examples/](./markdown/examples/) - Real-world integration examples
- **SDKs**: [sdk/](./sdk/) - Client libraries for multiple languages
- **Collections**: [collections/](./collections/) - Postman and Insomnia collections

## 🚀 Quick Start

1. **Explore the API**: Visit [swagger-ui/](./swagger-ui/) for interactive documentation
2. **Get your API key**: Sign up at https://videogeneration.platform
3. **Choose your SDK**: Check the [sdk/](./sdk/) directory for your language
4. **Follow examples**: See [markdown/examples/](./markdown/examples/) for integration guides

## 📚 Documentation Structure

\`\`\`
docs/
├── swagger-ui/           # Interactive Swagger UI
├── sdk/                  # Generated SDKs
│   ├── typescript/       # TypeScript/JavaScript SDK
│   ├── python/           # Python SDK
│   ├── go/               # Go SDK
│   └── java/             # Java SDK
├── markdown/             # Markdown documentation
│   ├── api-reference.md  # Complete API reference
│   └── examples/         # Usage examples
├── collections/          # API client collections
│   ├── video-api.postman_collection.json
│   └── video-api.insomnia_collection.json
└── video-api.yaml        # OpenAPI specification
\`\`\`

## 🔗 Links

- **Production API**: https://api.videogeneration.platform/api/v1
- **Status Page**: https://status.videogeneration.platform
- **Support**: api-support@videogeneration.platform
- **GitHub**: https://github.com/videogeneration/platform

---

Generated on ${new Date().toISOString()} | Version ${this.version}
`;
  }

  generateSitemap() {
    const baseUrl = "https://docs.videogeneration.platform";
    const pages = [
      "",
      "swagger-ui/",
      "markdown/api-reference.html",
      "markdown/examples/",
      "sdk/",
      "collections/",
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}/${page}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page === "" ? "1.0" : "0.8"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  }

  generateRobotsTxt() {
    return `User-agent: *
Allow: /

Sitemap: https://docs.videogeneration.platform/sitemap.xml`;
  }

  async generateReport() {
    console.log("📊 Generating build report...");

    const report = {
      version: this.version,
      timestamp: new Date().toISOString(),
      duration: `${((Date.now() - this.startTime) / 1000).toFixed(2)}s`,
      status: this.errors.length > 0 ? "failed" : "success",
      errors: this.errors,
      warnings: this.warnings,
      generated: {
        swaggerUI: fs.existsSync(
          path.join(CONFIG.outputDir, "swagger-ui", "index.html"),
        ),
        typescriptSDK: fs.existsSync(
          path.join(CONFIG.outputDir, "sdk", "package.json"),
        ),
        markdownDocs: fs.existsSync(
          path.join(CONFIG.outputDir, "markdown", "api-reference.md"),
        ),
        postmanCollection: fs.existsSync(
          path.join(
            CONFIG.outputDir,
            "collections",
            "video-api.postman_collection.json",
          ),
        ),
        staticSite: fs.existsSync(
          path.join(CONFIG.deploymentDir, "site", "index.html"),
        ),
      },
      deployment: {
        github: CONFIG.deployment.github.enabled,
        s3: CONFIG.deployment.s3.enabled,
        netlify: CONFIG.deployment.netlify.enabled,
      },
    };

    fs.writeFileSync(
      path.join(CONFIG.outputDir, "build-report.json"),
      JSON.stringify(report, null, 2),
    );

    // Log summary
    console.log("\n📊 Build Report:");
    console.log(`   Version: ${report.version}`);
    console.log(`   Duration: ${report.duration}`);
    console.log(`   Status: ${report.status}`);
    console.log(`   Errors: ${report.errors.length}`);
    console.log(`   Warnings: ${report.warnings.length}`);

    if (report.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      report.warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    if (report.errors.length > 0) {
      console.log("\n❌ Errors:");
      report.errors.forEach((error) => console.log(`   - ${error}`));
    }
  }

  // Utility methods
  getCurrentVersion() {
    try {
      const packagePath = path.resolve(__dirname, "../../../package.json");
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        return pkg.version || "1.0.0";
      }

      const versionPath = path.resolve(__dirname, CONFIG.versionFile);
      if (fs.existsSync(versionPath)) {
        return fs.readFileSync(versionPath, "utf8").trim();
      }

      return "1.0.0";
    } catch (error) {
      console.warn("Could not determine version, using 1.0.0");
      return "1.0.0";
    }
  }

  shouldDeploy() {
    return (
      CONFIG.deployment.github.enabled ||
      CONFIG.deployment.s3.enabled ||
      CONFIG.deployment.netlify.enabled
    );
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
      throw new Error(`Source directory does not exist: ${src}`);
    }

    fs.mkdirSync(dest, { recursive: true });

    const items = fs.readdirSync(src);

    items.forEach((item) => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--no-deploy":
        CONFIG.deployment.github.enabled = false;
        CONFIG.deployment.s3.enabled = false;
        CONFIG.deployment.netlify.enabled = false;
        break;

      case "--github-only":
        CONFIG.deployment.github.enabled = true;
        CONFIG.deployment.s3.enabled = false;
        CONFIG.deployment.netlify.enabled = false;
        break;

      case "--s3-only":
        CONFIG.deployment.github.enabled = false;
        CONFIG.deployment.s3.enabled = true;
        CONFIG.deployment.netlify.enabled = false;
        break;

      case "--netlify-only":
        CONFIG.deployment.github.enabled = false;
        CONFIG.deployment.s3.enabled = false;
        CONFIG.deployment.netlify.enabled = true;
        break;

      case "--no-validation":
        CONFIG.validation.validateSpec = false;
        CONFIG.validation.generateTests = false;
        break;

      case "--help":
        console.log(`
Video API Documentation Generator

Usage: node generate-docs.js [options]

Options:
  --no-deploy       Skip deployment step
  --github-only     Deploy only to GitHub Pages
  --s3-only         Deploy only to AWS S3
  --netlify-only    Deploy only to Netlify
  --no-validation   Skip validation tests
  --help            Show this help message

Environment Variables:
  GITHUB_TOKEN             GitHub token for Pages deployment
  AWS_ACCESS_KEY_ID        AWS access key for S3 deployment
  AWS_SECRET_ACCESS_KEY    AWS secret key for S3 deployment
  NETLIFY_AUTH_TOKEN       Netlify auth token for deployment
  CLOUDFRONT_DISTRIBUTION_ID   CloudFront distribution for invalidation

Examples:
  node generate-docs.js
  node generate-docs.js --no-deploy
  node generate-docs.js --github-only
  node generate-docs.js --no-validation
`);
        process.exit(0);

      default:
        if (arg.startsWith("--")) {
          console.warn(`Unknown option: ${arg}`);
        }
    }
  }

  const generator = new DocumentationGenerator();
  generator.generate().catch((error) => {
    console.error("Generation failed:", error);
    process.exit(1);
  });
}

module.exports = DocumentationGenerator;
