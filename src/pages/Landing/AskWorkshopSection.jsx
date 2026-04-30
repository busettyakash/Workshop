import React from "react";
import {
  Globe,
  Building2,
  DollarSign,
  MapPin,
  Tag,
  BarChart3,
  Users,
  Search,
  Bot,
  Sparkles
} from "lucide-react";
import "./Landing.css";

export default function AskWorkshopSection() {
  return (
    <section className="ws-section ws-ai-section">
      <div className="ws-section-inner">
        <div className="ws-ai-layout">

          {/* Left Side: Text */}
          <div className="ws-ai-text-side">
            <h3 className="ws-ai-title">Deploy AI</h3>
            <p className="ws-ai-desc">
              Search and create with Ask Workshop, connect your stack with
              integrations, or put agents to work on complex tasks like
              inventory scoring and customer analysis.
            </p>
            <a href="#" className="ws-ai-explore">Explore AI →</a>
          </div>

          {/* Right Side: Graphic Area with Grid */}
          <div className="ws-ai-graphic-side">

            {/* The Tree Diagram */}
            <div className="ws-ai-tree">
              {/* Trigger */}
              <div className="ws-ai-trigger">
                <Search size={14} className="ws-ai-trigger-icon" />
                <span>New order found</span>
              </div>

              {/* Trunk line */}
              <div className="ws-ai-trunk">

                {/* Node 1 */}
                <div className="ws-ai-branch">
                  <div className="ws-ai-branch-line" />
                  <div className="ws-ai-node-content">
                    <div className="ws-ai-card">
                      <div className="ws-ai-card-top">
                        <div className="ws-ai-bot-icon">
                          <Bot size={14} />
                        </div>
                        <span className="ws-ai-card-title">Activate loyalty check</span>
                        <span className="ws-ai-card-badge">AI</span>
                      </div>
                      <div className="ws-ai-card-question">
                        Does this customer qualify for loyalty rewards?
                      </div>
                    </div>
                    <div className="ws-ai-answer-pill">
                      <Sparkles size={12} className="ws-ai-sparkle-icon" />
                      <span>Yes, they are a <span className="ws-ai-purple-text">Gold Tier</span> customer</span>
                    </div>
                  </div>
                </div>

                {/* Node 2 */}
                <div className="ws-ai-branch">
                  <div className="ws-ai-branch-line" />
                  <div className="ws-ai-node-content">
                    <div className="ws-ai-card">
                      <div className="ws-ai-card-top">
                        <div className="ws-ai-bot-icon">
                          <Bot size={14} />
                        </div>
                        <span className="ws-ai-card-title">Evaluate purchase value</span>
                        <span className="ws-ai-card-badge">AI</span>
                      </div>
                      <div className="ws-ai-card-question">
                        What's the lifetime spend of this customer?
                      </div>
                    </div>
                    <div className="ws-ai-answer-pill">
                      <Sparkles size={12} className="ws-ai-sparkle-icon" />
                      <span><span className="ws-ai-purple-text">₹2.4L</span> spent across <span className="ws-ai-purple-text">34 orders</span></span>
                    </div>
                  </div>
                </div>

                {/* Node 3 */}
                <div className="ws-ai-branch">
                  <div className="ws-ai-branch-line" />
                  <div className="ws-ai-node-content">
                    <div className="ws-ai-card">
                      <div className="ws-ai-card-top">
                        <div className="ws-ai-bot-icon">
                          <Bot size={14} />
                        </div>
                        <span className="ws-ai-card-title">Identify key contacts</span>
                        <span className="ws-ai-card-badge">AI</span>
                      </div>
                      <div className="ws-ai-card-question">
                        Who are the frequent buyers at this shop?
                      </div>
                    </div>
                    <div className="ws-ai-answer-pill">
                      <Sparkles size={12} className="ws-ai-sparkle-icon" />
                      <span><span className="ws-ai-purple-text">Rahul Sharma, Manager; Priya Mehta, Owner</span></span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* The Profile Card */}
            <div className="ws-ai-profile-container">
              <div className="ws-ai-profile">
                <div className="ws-ai-profile-header">
                  <div className="ws-ai-profile-avatar">RS</div>
                  <span className="ws-ai-profile-name">Rahul's Store</span>
                </div>

                <div className="ws-ai-profile-list">
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><Globe size={12} /> Domain</span>
                    <span className="ws-ai-pill-blue">rahulstore.com</span>
                  </div>
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><Building2 size={12} /> Name</span>
                    <span className="ws-ai-profile-val">Rahul's Store</span>
                  </div>
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><DollarSign size={12} /> Monthly Revenue</span>
                    <span className="ws-ai-pill-green">₹2-5L</span>
                  </div>
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><MapPin size={12} /> Location</span>
                    <span className="ws-ai-profile-val">Mumbai, India</span>
                  </div>
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><Tag size={12} /> Categories</span>
                    <div className="ws-ai-pill-group">
                      <span className="ws-ai-pill-purple">Retail</span>
                      <span className="ws-ai-pill-purple">Electronics</span>
                    </div>
                  </div>
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><BarChart3 size={12} /> Total Sales</span>
                    <span className="ws-ai-profile-val">₹28L this year</span>
                  </div>
                  <div className="ws-ai-profile-item">
                    <span className="ws-ai-profile-label"><Users size={12} /> Staff</span>
                    <span className="ws-ai-profile-val ws-ai-text-muted">Rahul Sharma, ...</span>
                  </div>
                </div>
              </div>

              {/* Atom Graphic */}
              <div className="ws-ai-atom">
                <div className="ws-ai-atom-ring ws-ai-atom-ring-1"></div>
                <div className="ws-ai-atom-ring ws-ai-atom-ring-2"></div>
                <div className="ws-ai-atom-dot"></div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}