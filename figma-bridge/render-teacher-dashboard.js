import http from 'http';

export const teacherDashboardSpec = {
  type: "FRAME",
  name: "Teacher Dashboard - ASL Learning System",
  width: 1440,
  height: 960,
  x: 50,
  y: 50,
  backgroundColor: "#F8FAFC", // Slate-50 background
  layoutMode: "HORIZONTAL",
  padding: 0,
  itemSpacing: 0,
  children: [
    // 1. LEFT SIDEBAR
    {
      type: "FRAME",
      name: "Sidebar",
      width: 260,
      height: 960,
      backgroundColor: "#0F172A", // Dark Slate
      layoutMode: "VERTICAL",
      padding: 20,
      itemSpacing: 24,
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "MIN",
      children: [
        // Brand / Logo
        {
          type: "FRAME",
          name: "Brand Header",
          width: 220,
          height: 50,
          backgroundColor: "#1E293B",
          cornerRadius: 10,
          layoutMode: "HORIZONTAL",
          padding: 12,
          itemSpacing: 10,
          primaryAxisAlignItems: "CENTER",
          counterAxisAlignItems: "CENTER",
          children: [
            {
              type: "RECTANGLE",
              name: "Logo Icon",
              width: 28,
              height: 28,
              cornerRadius: 6,
              backgroundColor: "#2563EB"
            },
            {
              type: "TEXT",
              name: "Brand Title",
              text: "ASL Teacher Portal",
              fontSize: 15,
              color: "#FFFFFF",
              fontFamily: "Inter",
              fontStyle: "Bold"
            }
          ]
        },

        // Subjects Section Title
        {
          type: "TEXT",
          name: "Section Label",
          text: "CURRICULUM TOPICS",
          fontSize: 11,
          color: "#94A3B8",
          fontFamily: "Inter",
          fontStyle: "Bold"
        },

        // Subject Items
        {
          type: "FRAME",
          name: "Topic - Story Grammar (Active)",
          width: 220,
          height: 40,
          backgroundColor: "#2563EB",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 10,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Icon",
              text: "📖",
              fontSize: 14,
              color: "#FFFFFF"
            },
            {
              type: "TEXT",
              name: "Name",
              text: "Story Grammar",
              fontSize: 13,
              color: "#FFFFFF",
              fontFamily: "Inter",
              fontStyle: "Bold"
            }
          ]
        },
        {
          type: "FRAME",
          name: "Topic - Mathematics",
          width: 220,
          height: 40,
          backgroundColor: "#1E293B",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 10,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Icon",
              text: "🔢",
              fontSize: 14,
              color: "#94A3B8"
            },
            {
              type: "TEXT",
              name: "Name",
              text: "Mathematics",
              fontSize: 13,
              color: "#CBD5E1"
            }
          ]
        },
        {
          type: "FRAME",
          name: "Topic - TLE (ICT)",
          width: 220,
          height: 40,
          backgroundColor: "#1E293B",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 10,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Icon",
              text: "💻",
              fontSize: 14,
              color: "#94A3B8"
            },
            {
              type: "TEXT",
              name: "Name",
              text: "TLE (ICT)",
              fontSize: 13,
              color: "#CBD5E1"
            }
          ]
        },
        {
          type: "FRAME",
          name: "Topic - Araling Panlipunan",
          width: 220,
          height: 40,
          backgroundColor: "#1E293B",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 10,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Icon",
              text: "🌏",
              fontSize: 14,
              color: "#94A3B8"
            },
            {
              type: "TEXT",
              name: "Name",
              text: "Araling Panlipunan",
              fontSize: 13,
              color: "#CBD5E1"
            }
          ]
        },

        // Spacer / Divider
        {
          type: "RECTANGLE",
          name: "Divider",
          width: 220,
          height: 1,
          backgroundColor: "#334155"
        },

        // Bottom Actions: History, Trash Bin, Log Out
        {
          type: "FRAME",
          name: "Teacher History Button",
          width: 220,
          height: 38,
          backgroundColor: "#1E293B",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 8,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Label",
              text: "⏱  Teacher History",
              fontSize: 12,
              color: "#94A3B8"
            }
          ]
        },
        {
          type: "FRAME",
          name: "Trash Bin Button",
          width: 220,
          height: 38,
          backgroundColor: "#1E293B",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 8,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Label",
              text: "🗑  Trash Bin (0)",
              fontSize: 12,
              color: "#94A3B8"
            }
          ]
        },
        {
          type: "FRAME",
          name: "Log Out Button",
          width: 220,
          height: 38,
          backgroundColor: "#450A0A",
          cornerRadius: 8,
          layoutMode: "HORIZONTAL",
          padding: 10,
          itemSpacing: 8,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Label",
              text: "🚪  Log Out",
              fontSize: 12,
              color: "#F87171",
              fontStyle: "Bold"
            }
          ]
        }
      ]
    },

    // 2. MAIN CONTENT AREA
    {
      type: "FRAME",
      name: "Main Area",
      width: 1180,
      height: 960,
      backgroundColor: "#F8FAFC",
      layoutMode: "VERTICAL",
      padding: 32,
      itemSpacing: 24,
      children: [
        // Top Navigation Tabs Bar
        {
          type: "FRAME",
          name: "Navigation Tabs Bar",
          width: 1116,
          height: 56,
          backgroundColor: "#FFFFFF",
          cornerRadius: 12,
          strokeColor: "#E2E8F0",
          strokeWeight: 1,
          layoutMode: "HORIZONTAL",
          padding: 8,
          itemSpacing: 12,
          primaryAxisAlignItems: "CENTER",
          children: [
            {
              type: "FRAME",
              name: "Tab 1: Current Lessons (Active)",
              width: 160,
              height: 40,
              backgroundColor: "#EFF6FF",
              cornerRadius: 8,
              strokeColor: "#BFDBFE",
              strokeWeight: 1,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "TEXT",
                  name: "Label",
                  text: "📚 Current Lessons",
                  fontSize: 13,
                  color: "#2563EB",
                  fontStyle: "Bold"
                }
              ]
            },
            {
              type: "FRAME",
              name: "Tab 2: Create Lesson",
              width: 150,
              height: 40,
              backgroundColor: "#FFFFFF",
              cornerRadius: 8,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "TEXT",
                  name: "Label",
                  text: "➕ Create Lesson",
                  fontSize: 13,
                  color: "#64748B"
                }
              ]
            },
            {
              type: "FRAME",
              name: "Tab 3: Create Quiz",
              width: 150,
              height: 40,
              backgroundColor: "#FFFFFF",
              cornerRadius: 8,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "TEXT",
                  name: "Label",
                  text: "❓ Create Quiz",
                  fontSize: 13,
                  color: "#64748B"
                }
              ]
            },
            {
              type: "FRAME",
              name: "Tab 4: Class Analytics",
              width: 160,
              height: 40,
              backgroundColor: "#FFFFFF",
              cornerRadius: 8,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "TEXT",
                  name: "Label",
                  text: "📊 Class Analytics",
                  fontSize: 13,
                  color: "#64748B"
                }
              ]
            }
          ]
        },

        // Curriculum Header Bar
        {
          type: "FRAME",
          name: "Curriculum Header Card",
          width: 1116,
          height: 80,
          backgroundColor: "#FFFFFF",
          cornerRadius: 12,
          strokeColor: "#E2E8F0",
          strokeWeight: 1,
          layoutMode: "HORIZONTAL",
          padding: 20,
          primaryAxisAlignItems: "CENTER",
          counterAxisAlignItems: "CENTER",
          children: [
            {
              type: "FRAME",
              name: "Header Text Column",
              width: 900,
              height: 50,
              layoutMode: "VERTICAL",
              itemSpacing: 4,
              children: [
                {
                  type: "TEXT",
                  name: "Title",
                  text: "Story Grammar Curriculum",
                  fontSize: 20,
                  color: "#0F172A",
                  fontStyle: "Bold"
                },
                {
                  type: "TEXT",
                  name: "Subtitle",
                  text: "Manage stories, difficulty tiers (Easy / Medium / Hard), slides, and attached quizzes in one place.",
                  fontSize: 13,
                  color: "#64748B"
                }
              ]
            },
            {
              type: "FRAME",
              name: "Refresh Button",
              width: 110,
              height: 38,
              backgroundColor: "#EFF6FF",
              cornerRadius: 8,
              strokeColor: "#BFDBFE",
              strokeWeight: 1,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "TEXT",
                  name: "Button Text",
                  text: "🔄 Refresh",
                  fontSize: 12,
                  color: "#2563EB",
                  fontStyle: "Bold"
                }
              ]
            }
          ]
        },

        // Story Group Card 1 (The Tortoise and the Hare)
        {
          type: "FRAME",
          name: "Story Card - Tortoise and Hare",
          width: 1116,
          height: 290,
          backgroundColor: "#FFFFFF",
          cornerRadius: 12,
          strokeColor: "#E2E8F0",
          strokeWeight: 1,
          layoutMode: "VERTICAL",
          padding: 20,
          itemSpacing: 16,
          children: [
            // Story Card Header
            {
              type: "FRAME",
              name: "Story Header",
              width: 1076,
              height: 40,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "FRAME",
                  name: "Story Title Box",
                  width: 920,
                  height: 40,
                  layoutMode: "VERTICAL",
                  children: [
                    {
                      type: "TEXT",
                      name: "Title",
                      text: "📖 The Tortoise and the Hare",
                      fontSize: 16,
                      color: "#1E293B",
                      fontStyle: "Bold"
                    },
                    {
                      type: "TEXT",
                      name: "Sub",
                      text: "3 of 3 tiers created (EASY, MEDIUM, HARD)",
                      fontSize: 12,
                      color: "#64748B"
                    }
                  ]
                },
                {
                  type: "FRAME",
                  name: "Trash Story Button",
                  width: 120,
                  height: 32,
                  backgroundColor: "#FEF2F2",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Trash Label",
                      text: "🗑 Trash Story",
                      fontSize: 12,
                      color: "#DC2626",
                      fontStyle: "Bold"
                    }
                  ]
                }
              ]
            },

            // Tier 1: Easy
            {
              type: "FRAME",
              name: "Tier Row - Easy",
              width: 1076,
              height: 52,
              backgroundColor: "#F8FAFC",
              cornerRadius: 8,
              strokeColor: "#E2E8F0",
              strokeWeight: 1,
              layoutMode: "HORIZONTAL",
              padding: 12,
              itemSpacing: 16,
              primaryAxisAlignItems: "CENTER",
              children: [
                {
                  type: "FRAME",
                  name: "Badge Easy",
                  width: 70,
                  height: 26,
                  backgroundColor: "#DCFCE7",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Badge Text",
                      text: "EASY",
                      fontSize: 11,
                      color: "#15803D",
                      fontStyle: "Bold"
                    }
                  ]
                },
                {
                  type: "TEXT",
                  name: "Slide Info",
                  text: "🖼  5 Slides",
                  fontSize: 13,
                  color: "#334155"
                },
                {
                  type: "FRAME",
                  name: "Edit Slides Btn",
                  width: 100,
                  height: 28,
                  backgroundColor: "#EFF6FF",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Btn Text",
                      text: "✏ Edit Slides",
                      fontSize: 11,
                      color: "#2563EB",
                      fontStyle: "Bold"
                    }
                  ]
                },
                {
                  type: "TEXT",
                  name: "Quiz Status",
                  text: "✓  Quiz Attached (5 Questions)",
                  fontSize: 13,
                  color: "#059669",
                  fontStyle: "Bold"
                },
                {
                  type: "FRAME",
                  name: "Edit Quiz Btn",
                  width: 90,
                  height: 28,
                  backgroundColor: "#ECFDF5",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Btn Text",
                      text: "Edit Quiz",
                      fontSize: 11,
                      color: "#059669"
                    }
                  ]
                }
              ]
            },

            // Tier 2: Medium
            {
              type: "FRAME",
              name: "Tier Row - Medium",
              width: 1076,
              height: 52,
              backgroundColor: "#F8FAFC",
              cornerRadius: 8,
              strokeColor: "#E2E8F0",
              strokeWeight: 1,
              layoutMode: "HORIZONTAL",
              padding: 12,
              itemSpacing: 16,
              primaryAxisAlignItems: "CENTER",
              children: [
                {
                  type: "FRAME",
                  name: "Badge Medium",
                  width: 70,
                  height: 26,
                  backgroundColor: "#FEF9C3",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Badge Text",
                      text: "MEDIUM",
                      fontSize: 11,
                      color: "#A16207",
                      fontStyle: "Bold"
                    }
                  ]
                },
                {
                  type: "TEXT",
                  name: "Slide Info",
                  text: "🖼  6 Slides",
                  fontSize: 13,
                  color: "#334155"
                },
                {
                  type: "FRAME",
                  name: "Edit Slides Btn",
                  width: 100,
                  height: 28,
                  backgroundColor: "#EFF6FF",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Btn Text",
                      text: "✏ Edit Slides",
                      fontSize: 11,
                      color: "#2563EB",
                      fontStyle: "Bold"
                    }
                  ]
                },
                {
                  type: "TEXT",
                  name: "Quiz Status",
                  text: "✓  Quiz Attached (5 Questions)",
                  fontSize: 13,
                  color: "#059669",
                  fontStyle: "Bold"
                },
                {
                  type: "FRAME",
                  name: "Edit Quiz Btn",
                  width: 90,
                  height: 28,
                  backgroundColor: "#ECFDF5",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Btn Text",
                      text: "Edit Quiz",
                      fontSize: 11,
                      color: "#059669"
                    }
                  ]
                }
              ]
            },

            // Tier 3: Hard
            {
              type: "FRAME",
              name: "Tier Row - Hard",
              width: 1076,
              height: 52,
              backgroundColor: "#F8FAFC",
              cornerRadius: 8,
              strokeColor: "#E2E8F0",
              strokeWeight: 1,
              layoutMode: "HORIZONTAL",
              padding: 12,
              itemSpacing: 16,
              primaryAxisAlignItems: "CENTER",
              children: [
                {
                  type: "FRAME",
                  name: "Badge Hard",
                  width: 70,
                  height: 26,
                  backgroundColor: "#FEE2E2",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Badge Text",
                      text: "HARD",
                      fontSize: 11,
                      color: "#B91C1C",
                      fontStyle: "Bold"
                    }
                  ]
                },
                {
                  type: "TEXT",
                  name: "Slide Info",
                  text: "🖼  7 Slides",
                  fontSize: 13,
                  color: "#334155"
                },
                {
                  type: "FRAME",
                  name: "Edit Slides Btn",
                  width: 100,
                  height: 28,
                  backgroundColor: "#EFF6FF",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Btn Text",
                      text: "✏ Edit Slides",
                      fontSize: 11,
                      color: "#2563EB",
                      fontStyle: "Bold"
                    }
                  ]
                },
                {
                  type: "TEXT",
                  name: "Quiz Status",
                  text: "⚠  No quiz attached",
                  fontSize: 13,
                  color: "#D97706",
                  fontStyle: "Bold"
                },
                {
                  type: "FRAME",
                  name: "Attach Quiz Btn",
                  width: 100,
                  height: 28,
                  backgroundColor: "#FEF3C7",
                  cornerRadius: 6,
                  layoutMode: "HORIZONTAL",
                  primaryAxisAlignItems: "CENTER",
                  counterAxisAlignItems: "CENTER",
                  children: [
                    {
                      type: "TEXT",
                      name: "Btn Text",
                      text: "➕ Add Quiz",
                      fontSize: 11,
                      color: "#B45309",
                      fontStyle: "Bold"
                    }
                  ]
                }
              ]
            }
          ]
        },

        // Bottom CTA Banner to create next story
        {
          type: "FRAME",
          name: "Add New Lesson Banner",
          width: 1116,
          height: 60,
          backgroundColor: "#FFFFFF",
          cornerRadius: 12,
          strokeColor: "#CBD5E1",
          strokeWeight: 1,
          layoutMode: "HORIZONTAL",
          padding: 16,
          primaryAxisAlignItems: "CENTER",
          counterAxisAlignItems: "CENTER",
          children: [
            {
              type: "TEXT",
              name: "Prompt",
              text: "Need to introduce a new story or lesson topic?",
              fontSize: 13,
              color: "#64748B"
            },
            {
              type: "FRAME",
              name: "Create Lesson Button",
              width: 170,
              height: 38,
              backgroundColor: "#2563EB",
              cornerRadius: 8,
              layoutMode: "HORIZONTAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                {
                  type: "TEXT",
                  name: "Button Label",
                  text: "➕ Create New Story",
                  fontSize: 13,
                  color: "#FFFFFF",
                  fontStyle: "Bold"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Render runner script
const req = http.request({
  hostname: 'localhost',
  port: 4321,
  path: '/render',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Render Response:', data));
});

req.on('error', (e) => console.error('Error:', e.message));

req.write(JSON.stringify(teacherDashboardSpec));
req.end();
