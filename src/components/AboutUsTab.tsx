import { Mail, Github, Code2, Heart, MapPin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AboutUsTab() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          About Plan Compass
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Hospital M&E Performance Tracking System - Built for healthcare excellence and data-driven decision making
        </p>
      </div>

      {/* Application Overview */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-blue-50/50 to-purple-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Application Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Purpose</h3>
              <p className="text-muted-foreground">
                Plan Compass is a comprehensive Monitoring & Evaluation (M&E) system designed for healthcare facilities to track performance indicators, manage master plans, and ensure data-driven decision making.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Key Features</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Real-time KPI Dashboard
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Data Entry & Auto-save
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Secure Data Backup
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span> Multi-channel Distribution
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Developer Info Card */}
      <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-amber-600" />
            Developer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Developer Profile */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                NM
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground">Nuredin Muhammed</h3>
                <p className="text-muted-foreground">Full-Stack Developer</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Building innovative healthcare solutions with modern technology
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
            {/* Email */}
            <a
              href="mailto:nuredinmuhammed176@gmail.com"
              className="group p-4 rounded-lg border border-boundary/30 hover:border-amber-400 hover:bg-amber-100/20 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-amber-600 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm font-semibold text-foreground group-hover:text-amber-700">
                    nuredinmuhammed176@gmail.com
                  </p>
                </div>
              </div>
            </a>

            {/* GitHub */}
            <a
              href="https://github.com/nuredin11-md"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-4 rounded-lg border border-boundary/30 hover:border-gray-400 hover:bg-gray-100/20 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5 text-gray-700 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="text-xs text-muted-foreground">GitHub</p>
                  <p className="font-mono text-sm font-semibold text-foreground group-hover:text-gray-700">
                    github.com/nuredin11-md
                  </p>
                </div>
              </div>
            </a>
          </div>

          {/* Contact Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              asChild
              className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
            >
              <a href="mailto:nuredinmuhammed176@gmail.com">
                <Mail className="h-4 w-4" />
                Send Email
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 gap-2 border-gray-300 hover:bg-gray-50"
            >
              <a
                href="https://github.com/nuredin11-md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4" />
                Visit GitHub
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Technology Stack */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Technology Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">Frontend</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• React 18 + TypeScript</li>
                <li>• Vite + TailwindCSS</li>
                <li>• shadcn/ui Components</li>
                <li>• Recharts Visualization</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">Backend</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Supabase PostgreSQL</li>
                <li>• Authentication & Auth</li>
                <li>• Row-Level Security</li>
                <li>• Real-time Subscriptions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Data Encryption</li>
                <li>• Backup & Recovery</li>
                <li>• Audit Logging</li>
                <li>• Multi-channel Export</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features & Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Core Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-semibold text-sm text-primary mb-2">Dashboard</p>
              <p className="text-sm text-muted-foreground">
                Real-time KPI metrics with visual indicators and performance tracking
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-semibold text-sm text-primary mb-2">Data Entry</p>
              <p className="text-sm text-muted-foreground">
                Auto-save enabled monthly data entry with validation and audit logging
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-semibold text-sm text-primary mb-2">Security</p>
              <p className="text-sm text-muted-foreground">
                Encrypted storage, input validation, and comprehensive backup system
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-semibold text-sm text-primary mb-2">Distribution</p>
              <p className="text-sm text-muted-foreground">
                Multi-channel sharing via Telegram and WhatsApp with secure credentials
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-semibold text-sm text-primary mb-2">Analysis</p>
              <p className="text-sm text-muted-foreground">
                Data quality assessment and year-on-year performance comparison
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-semibold text-sm text-primary mb-2">Export</p>
              <p className="text-sm text-muted-foreground">
                Export reports in PDF and Excel formats with customizable layouts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Built with passion for healthcare excellence
            </p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              © {currentYear} Plan Compass. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Developed by <span className="font-semibold text-foreground">Nuredin Muhammed</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
