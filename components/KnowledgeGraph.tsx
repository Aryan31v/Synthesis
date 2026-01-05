import React, { useEffect, useRef, useState, useMemo } from 'react';
import { KnowledgeNode, MindState, ChatMessage, LearningPath } from '../types';
import { ZoomIn, ZoomOut, Maximize, BrainCircuit, X, Folder, FileText, PlusCircle, Trash2, Sparkles, Plus, Upload, Loader, Network, Info, BookOpen, MonitorPlay, ExternalLink, Save, MessageSquare, Send, Minimize2, Bot, Waypoints, MapPin } from 'lucide-react';
import { analyzeContent, expandNodeConcepts, NodeExpansion, streamChatResponse, extractJSONFromMarkdown } from '../services/geminiService';
import { extractTextFromFile } from '../services/fileProcessingService';
import ReactMarkdown from 'react-markdown';

interface KnowledgeGraphProps {
  nodes: KnowledgeNode[];
  mindState?: MindState;
  onNodeSelect: (node: KnowledgeNode) => void;
  onAddFile: (text: string) => void;
  onAddNode: (node: KnowledgeNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onCreateManualPath: (node: KnowledgeNode) => void;
  onAnalyzeMind: () => Promise<void>;
  onUpdateNode: (nodeId: string, updates: Partial<KnowledgeNode>) => void;
  paths?: LearningPath[];
}

interface GraphLink {
  source: string;
  target: string;
  weight: number;
  sharedTerms: string[];
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ 
  nodes: initialNodes, 
  mindState,
  onNodeSelect, 
  onAddFile,
  onAddNode,
  onDeleteNode,
  onCreateManualPath,
  onAnalyzeMind,
  onUpdateNode,
  paths
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [nodes, setNodes] = useState<KnowledgeNode[]>(initialNodes);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  
  // Content Editing State
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Expansion State
  const [expansionData, setExpansionData] = useState<NodeExpansion>({ subTopics: [], books: [], videos: [] });
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);

  // Path Tracing State
  const [isTracingMode, setIsTracingMode] = useState(false);
  const [traceTargetId, setTraceTargetId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string[]>([]); // Array of Node IDs

  // Graph Chat State
  const [showChat, setShowChat] = useState(false);
  const [graphChatHistory, setGraphChatHistory] = useState<ChatMessage[]>([
      { id: 'g-welcome', role: 'model', content: 'I am here to help you manipulate the graph. Ask me to add nodes or connect ideas.' }
  ]);
  const [graphChatInput, setGraphChatInput] = useState('');
  const [isGraphChatStreaming, setIsGraphChatStreaming] = useState(false);
  const graphChatEndRef = useRef<HTMLDivElement>(null);

  const interactionState = useRef({
    dragNode: null as KnowledgeNode | null,
    isDraggingCanvas: false,
    isPinching: false,
    lastMousePos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    zoom: 0.8,
    initialPinchDist: 0,
    lastTouchPos: { x: 0, y: 0 }
  });
  
  const [, setRenderTrigger] = useState(0);

  // 1. Pre-calculate Links and Weights
  const links = useMemo(() => {
    const calculatedLinks: GraphLink[] = [];
    const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'for', 'with', 'on']);
    
    const getTerms = (n: KnowledgeNode) => {
       const text = `${n.title} ${n.tags.join(' ')}`.toLowerCase();
       return text.split(/[\W_]+/).filter(w => w.length > 3 && !stopWords.has(w));
    };

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        
        // Base connection on Tags
        const hasTagConnection = n1.tags.some(t => n2.tags.includes(t));
        
        if (hasTagConnection) {
            const terms1 = getTerms(n1);
            const terms2 = getTerms(n2);
            const shared = terms1.filter(t => terms2.includes(t));
            const uniqueShared = [...new Set(shared)]; // dedup
            
            // Weight 1 (base) to 5 (strong)
            // 1 match = weight 2, 3+ matches = weight 3-5
            let weight = 1 + Math.min(4, uniqueShared.length);
            
            // Boost weight if they share a direct parent/child naming convention or exact tag match count is high
            const sharedTags = n1.tags.filter(t => n2.tags.includes(t));
            if (sharedTags.length > 2) weight = Math.min(5, weight + 1);

            calculatedLinks.push({
                source: n1.id,
                target: n2.id,
                weight,
                sharedTerms: uniqueShared.slice(0, 3) // Keep top 3 for display
            });
        }
      }
    }
    return calculatedLinks;
  }, [nodes]);

  // BFS Shortest Path
  const findShortestPath = (startId: string, endId: string) => {
      const queue: string[][] = [[startId]];
      const visited = new Set<string>();
      
      while (queue.length > 0) {
          const path = queue.shift()!;
          const node = path[path.length - 1];
          
          if (node === endId) return path;
          
          if (!visited.has(node)) {
              visited.add(node);
              // Find neighbors via links
              const neighbors = links
                  .filter(l => l.source === node || l.target === node)
                  .map(l => l.source === node ? l.target : l.source);
              
              for (const neighbor of neighbors) {
                  queue.push([...path, neighbor]);
              }
          }
      }
      return [];
  };

  const handleTracePath = () => {
     if (!selectedNode) return;
     setIsTracingMode(true);
     setTraceTargetId(null);
     setActivePath([]);
  };

  const executeTrace = (targetNode: KnowledgeNode) => {
      if (!selectedNode) return;
      const path = findShortestPath(selectedNode.id, targetNode.id);
      if (path.length > 0) {
          setActivePath(path);
          setTraceTargetId(targetNode.id);
      } else {
          alert("No connection found between these nodes.");
          setIsTracingMode(false);
      }
  };

  useEffect(() => { setNodes(initialNodes); }, [initialNodes]);

  useEffect(() => {
    if (selectedNode) {
        setEditedContent(selectedNode.content || '');
    }
  }, [selectedNode]);

  useEffect(() => {
      if (showChat) {
          graphChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [graphChatHistory, showChat]);

  // Initial Placement Jitter
  useEffect(() => {
    nodes.forEach((node, i) => {
      if (node.x === undefined || Number.isNaN(node.x)) {
        const angle = i * 0.5;
        const radius = 50 + i * 5; 
        node.x = Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
        node.y = Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
        node.vx = 0; node.vy = 0;
      }
      if (node.connections === undefined) {
          node.connections = links.filter(l => l.source === node.id || l.target === node.id).length;
      }
      if (!node.lastAccessed) node.lastAccessed = Date.now();
    });
  }, [nodes, links]);

  // CLUSTER FORCE CALCULATION
  const clusterCenters = useMemo(() => {
      if (!mindState?.clusters) return {};
      const centers: {[key: string]: {x: number, y: number, color: string}} = {};
      const count = mindState.clusters.length;
      const radius = 400; // Pull clusters apart
      
      mindState.clusters.forEach((c, i) => {
          const angle = (i / count) * Math.PI * 2;
          centers[c.id] = {
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius,
              color: `hsl(${(i / count) * 360}, 70%, 50%)`
          };
      });
      return centers;
  }, [mindState]);

  const drawClusters = (ctx: CanvasRenderingContext2D, zoom: number) => {
    if (!mindState?.clusters) return;
    if (zoom < 0.2) return; 

    mindState.clusters.forEach(cluster => {
      const clusterNodes = nodes.filter(n => cluster.nodeIds.includes(n.id));
      if (clusterNodes.length < 1) return;
      
      // Calculate Centroid
      const avgX = clusterNodes.reduce((acc, n) => acc + (n.x || 0), 0) / clusterNodes.length;
      const avgY = clusterNodes.reduce((acc, n) => acc + (n.y || 0), 0) / clusterNodes.length;
      
      const config = clusterCenters[cluster.id];
      const color = config ? config.color : '#6366f1';

      ctx.save();
      // Organic Blob for cluster area
      const gradient = ctx.createRadialGradient(avgX, avgY, 0, avgX, avgY, 250);
      gradient.addColorStop(0, color.replace(')', ', 0.1)'));
      gradient.addColorStop(1, color.replace(')', ', 0)'));
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(avgX, avgY, 250, 0, Math.PI * 2);
      ctx.fill();

      // Cluster Label
      if (zoom > 0.4) {
          ctx.font = `800 40px Inter`; 
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = color.replace(')', ', 0.15)');
          ctx.fillText(cluster.themeName.toUpperCase(), avgX, avgY);
      }
      ctx.restore();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const NOW = Date.now();
    const STAGNATION_THRESHOLD = 3 * 24 * 60 * 60 * 1000; 

    const render = () => {
      if (!canvas || !containerRef.current) return;
      
      const { offset, zoom, dragNode } = interactionState.current;
      const dpr = window.devicePixelRatio || 1;
      const rect = containerRef.current.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
      }
      
      const center = { x: rect.width / 2, y: rect.height / 2 };

      // --- ADVANCED PHYSICS ENGINE ---
      const REPULSION = 5000; 
      const CENTER_GRAVITY = 0.0001; 
      const CLUSTER_STRENGTH = 0.002; // Pull to cluster center
      const DAMPING = 0.90; 
      const COLLISION_RADIUS = 25; 

      // Apply Forces
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node === dragNode) continue;
        
        let fx = 0; 
        let fy = 0;

        // 1. Repulsion
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const other = nodes[j];
          const dx = (node.x || 0) - (other.x || 0);
          const dy = (node.y || 0) - (other.y || 0);
          let distSq = dx * dx + dy * dy;
          if (distSq === 0) distSq = 1; 
          if (distSq < 100) distSq = 100;
          
          const dist = Math.sqrt(distSq);
          const rForce = REPULSION / distSq;
          fx += (dx / dist) * rForce;
          fy += (dy / dist) * rForce;

          // 2. Collision
          const minDistance = COLLISION_RADIUS + COLLISION_RADIUS;
          if (dist < minDistance) {
              const push = (minDistance - dist) / dist * 1.5; 
              fx += dx * push;
              fy += dy * push;
          }
        }

        // 3. Cluster Gravity (Thematic Grouping)
        if (mindState?.clusters) {
            const cluster = mindState.clusters.find(c => c.nodeIds.includes(node.id));
            if (cluster) {
                const target = clusterCenters[cluster.id];
                if (target) {
                    fx += (target.x - (node.x || 0)) * CLUSTER_STRENGTH;
                    fy += (target.y - (node.y || 0)) * CLUSTER_STRENGTH;
                }
            }
        }

        // 4. Center Gravity
        fx -= (node.x || 0) * CENTER_GRAVITY;
        fy -= (node.y || 0) * CENTER_GRAVITY;

        // Apply Velocity
        node.vx = ((node.vx || 0) + fx) * DAMPING;
        node.vy = ((node.vy || 0) + fy) * DAMPING;
        node.x = (node.x || 0) + node.vx;
        node.y = (node.y || 0) + node.vy;
      }

      // 5. Link Springs (Iterate links instead of nested loops for efficiency)
      links.forEach(link => {
          const n1 = nodes.find(n => n.id === link.source);
          const n2 = nodes.find(n => n.id === link.target);
          if (!n1 || !n2) return;
          if (n1 === dragNode || n2 === dragNode) return; // Don't pull dragged node too hard

          const dx = (n1.x || 0) - (n2.x || 0);
          const dy = (n1.y || 0) - (n2.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Weight-based physics: Higher weight = tighter, stronger spring
          const targetLength = 250 / link.weight; 
          const strength = 0.005 * link.weight; 

          const springForce = (dist - targetLength) * strength;
          const fx = (dx / dist) * springForce;
          const fy = (dy / dist) * springForce;

          if (n1 !== dragNode) {
              n1.vx = (n1.vx || 0) - fx;
              n1.vy = (n1.vy || 0) - fy;
          }
          if (n2 !== dragNode) {
              n2.vx = (n2.vx || 0) + fx;
              n2.vy = (n2.vy || 0) + fy;
          }
      });

      // --- RENDERING ---
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr); 
      ctx.translate(center.x + offset.x, center.y + offset.y);
      ctx.scale(zoom, zoom);

      drawClusters(ctx, zoom);

      // Draw Links
      ctx.lineCap = 'round';
      
      const activeNode = hoveredNode || selectedNode;
      const time = Date.now() / 1000;

      links.forEach(link => {
          const n1 = nodes.find(n => n.id === link.source);
          const n2 = nodes.find(n => n.id === link.target);
          if (!n1 || !n2) return;

          let opacity = 0.1 + (link.weight / 10); 
          let width = link.weight * 0.5;
          let color = `hsl(${180 + link.weight * 20}, 70%, 70%)`; // Teal to Blue gradient
          
          const isPathLink = activePath.length > 1 && 
            ((activePath.includes(n1.id) && activePath.includes(n2.id) && 
              Math.abs(activePath.indexOf(n1.id) - activePath.indexOf(n2.id)) === 1));

          const isFocusLink = activeNode && (n1.id === activeNode.id || n2.id === activeNode.id);

          if (activePath.length > 0) {
               if (isPathLink) {
                   opacity = 1;
                   width = 3 + Math.sin(time * 8) * 1; // Pulse
                   color = '#fbbf24'; // Gold
               } else {
                   opacity = 0.05; // Dim others
               }
          } else if (activeNode) {
               if (isFocusLink) {
                   opacity = 0.8;
                   width = 2;
                   color = '#a5b4fc';
               } else {
                   opacity = 0.05;
               }
          }

          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.globalAlpha = opacity;
          ctx.lineWidth = width / zoom;
          ctx.moveTo(n1.x || 0, n1.y || 0);
          ctx.lineTo(n2.x || 0, n2.y || 0);
          ctx.stroke();
          ctx.globalAlpha = 1;
      });

      // Draw Nodes
      nodes.forEach(node => {
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;
        const isInPath = activePath.includes(node.id);
        
        let isDimmed = false;
        if (activePath.length > 0) {
            isDimmed = !isInPath;
        } else if (activeNode) {
            // Check connectivity via links
            const connected = links.some(l => (l.source === activeNode.id && l.target === node.id) || (l.target === activeNode.id && l.source === node.id));
            isDimmed = activeNode.id !== node.id && !connected;
        }

        const baseRadius = (node.type === 'path' ? 12 : 6) + (Math.min(node.connections || 0, 10) * 0.5);
        const radius = (isHovered || isSelected || isInPath) ? baseRadius * 1.3 : baseRadius;
        
        const lastAccessed = node.lastAccessed || NOW;
        const isStagnant = (NOW - lastAccessed) > STAGNATION_THRESHOLD;
        
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius, 0, Math.PI * 2);
        
        // Colors
        if (isStagnant) {
            ctx.fillStyle = isSelected ? '#475569' : '#1e293b'; 
        } else {
            const nodeIntensity = mindState?.interestMatrix 
                ? (node.tags.reduce((acc, tag) => Math.max(acc, mindState.interestMatrix[tag] || 0), 0))
                : 0.5;
            let alpha = isDimmed ? 0.1 : (0.7 + (nodeIntensity * 0.3));
            
            if (isInPath) {
                ctx.fillStyle = '#fbbf24'; // Gold path
            } else if (node.type === 'path') {
                ctx.fillStyle = isSelected ? '#a5b4fc' : `rgba(99, 102, 241, ${alpha})`;
            } else {
                ctx.fillStyle = isSelected ? '#5eead4' : `rgba(20, 184, 166, ${alpha})`;
            }
        }
        
        ctx.fill();
        
        if (isInPath) {
             ctx.strokeStyle = '#fff';
             ctx.lineWidth = 2 / zoom;
             ctx.stroke();
        } else {
             ctx.strokeStyle = isSelected || isHovered ? '#ffffff' : (isDimmed ? 'rgba(15, 23, 42, 0.1)' : '#0f172a');
             ctx.lineWidth = (isSelected || isHovered ? 2 : 1) / zoom;
             ctx.stroke();
        }

        // Labels
        if (zoom > 0.6 || isSelected || isHovered || isInPath) {
            const screenFontSize = 10;
            const fontSize = screenFontSize / zoom; 
            
            ctx.font = `${node.type === 'path' || isInPath ? '700' : '500'} ${fontSize}px Inter`;
            ctx.textAlign = 'center';
            
            const gap = (radius + 8) / zoom;
            const paddingX = 8 / zoom;
            const paddingY = 4 / zoom;
            const textY = (node.y || 0) + gap;
            const textWidth = ctx.measureText(node.title).width;
            
            if (!isDimmed) {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                ctx.fillRect(
                    (node.x || 0) - textWidth/2 - paddingX, 
                    textY - fontSize * 0.8,
                    textWidth + paddingX * 2, 
                    fontSize + paddingY * 2
                );

                ctx.fillStyle = isInPath ? '#fbbf24' : (isStagnant ? '#94a3b8' : '#e2e8f0');
                ctx.fillText(node.title, node.x || 0, textY + paddingY);
            }
        }
      });
      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, links, selectedNode, hoveredNode, mindState, activePath]);

  // Event Handlers
  const getLogicalCoords = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const { offset, zoom } = interactionState.current;
      return { 
        x: (clientX - rect.left - rect.width / 2 - offset.x) / zoom, 
        y: (clientY - rect.top - rect.height / 2 - offset.y) / zoom 
      };
  }

  const handlePointerDown = (e: React.PointerEvent) => {
      if (!e.isPrimary) return; 
      const canvas = canvasRef.current; if(!canvas) return;
      
      // Only capture mouse to allow touch multitouch to bubble/handle correctly without conflict
      if (e.pointerType === 'mouse') {
          canvas.setPointerCapture(e.pointerId);
      }

      const coords = getLogicalCoords(e.clientX, e.clientY);
      const clicked = nodes.find(node => Math.sqrt(Math.pow((node.x || 0) - coords.x, 2) + Math.pow((node.y || 0) - coords.y, 2)) < 25);
      
      if (clicked) { 
        if (isTracingMode && selectedNode) {
            executeTrace(clicked);
            // Don't select, just trace
            return;
        }

        interactionState.current.dragNode = clicked; 
        setSelectedNode(clicked); 
        onNodeSelect(clicked); 
        setExpansionData({ subTopics: [], books: [], videos: [] });
        setIsGeneratingTopics(false);
        // Clear previous path unless we are specifically mode-switching
        if (!isTracingMode) setActivePath([]);
      } else { 
        interactionState.current.isDraggingCanvas = true; 
        interactionState.current.lastMousePos = { x: e.clientX, y: e.clientY }; 
        if (!isTracingMode) setSelectedNode(null);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (interactionState.current.isPinching) return; // Ignore pointers if pinching

      const coords = getLogicalCoords(e.clientX, e.clientY);
      
      // Hover Detection
      if (!interactionState.current.dragNode && !interactionState.current.isDraggingCanvas) {
          const hovered = nodes.find(node => Math.sqrt(Math.pow((node.x || 0) - coords.x, 2) + Math.pow((node.y || 0) - coords.y, 2)) < 25);
          setHoveredNode(hovered || null);
          if (canvasRef.current) {
              canvasRef.current.style.cursor = isTracingMode ? 'crosshair' : (hovered ? 'pointer' : 'default');
          }
          
          // Hover Link detection for Tooltip
          if (!hovered) {
             const hLink = links.find(l => {
                 const n1 = nodes.find(n => n.id === l.source);
                 const n2 = nodes.find(n => n.id === l.target);
                 if(!n1 || !n2) return false;
                 // Point line distance
                 const A = coords.x - (n1.x||0);
                 const B = coords.y - (n1.y||0);
                 const C = (n2.x||0) - (n1.x||0);
                 const D = (n2.y||0) - (n1.y||0);
                 const dot = A * C + B * D;
                 const lenSq = C * C + D * D;
                 let param = -1;
                 if (lenSq !== 0) param = dot / lenSq;
                 let xx, yy;
                 if (param < 0) { xx = n1.x||0; yy = n1.y||0; }
                 else if (param > 1) { xx = n2.x||0; yy = n2.y||0; }
                 else { xx = (n1.x||0) + param * C; yy = (n1.y||0) + param * D; }
                 const dx = coords.x - xx;
                 const dy = coords.y - yy;
                 return (dx * dx + dy * dy) < 100; // 10px radius tolerance
             });
             setHoveredLink(hLink || null);
          } else {
             setHoveredLink(null);
          }
      }

      if (!e.isPrimary) return;
      const state = interactionState.current;
      
      if (state.dragNode) { 
          state.dragNode.x = coords.x; 
          state.dragNode.y = coords.y; 
          state.dragNode.vx = 0; state.dragNode.vy = 0;
      }
      else if (state.isDraggingCanvas) {
          const dx = e.clientX - state.lastMousePos.x; const dy = e.clientY - state.lastMousePos.y;
          state.offset.x += dx; state.offset.y += dy; state.lastMousePos = { x: e.clientX, y: e.clientY };
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => { 
    if (!e.isPrimary) return;
    interactionState.current.dragNode = null; 
    interactionState.current.isDraggingCanvas = false; 
    
    // Only release if we captured it
    if (e.pointerType === 'mouse') {
        canvasRef.current?.releasePointerCapture(e.pointerId); 
    }
  };

  const handleWheel = (e: React.WheelEvent) => { 
    const delta = e.deltaY;
    const zoomIntensity = 0.001;
    interactionState.current.zoom = Math.min(Math.max(interactionState.current.zoom - delta * zoomIntensity, 0.1), 5);
    setRenderTrigger(v => v + 1);
  };

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
        interactionState.current.isPinching = true;
        interactionState.current.initialPinchDist = getTouchDistance(e.touches[0], e.touches[1]);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && interactionState.current.initialPinchDist > 0) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = dist / interactionState.current.initialPinchDist;
      
      // Update Zoom
      interactionState.current.zoom = Math.min(Math.max(interactionState.current.zoom * scale, 0.1), 5);
      
      // Reset initial for next delta
      interactionState.current.initialPinchDist = dist; 
      
      setRenderTrigger(v => v + 1);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
          interactionState.current.isPinching = false;
      }
  };

  const handleZoomIn = () => { interactionState.current.zoom = Math.min(interactionState.current.zoom * 1.2, 5); setRenderTrigger(v => v + 1); };
  const handleZoomOut = () => { interactionState.current.zoom = Math.max(interactionState.current.zoom * 0.8, 0.1); setRenderTrigger(v => v + 1); };
  const handleResetZoom = () => { interactionState.current.zoom = 1; interactionState.current.offset = { x: 0, y: 0 }; setRenderTrigger(v => v + 1); };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsProcessingFile(true);
    try { const text = await extractTextFromFile(file); await onAddFile(text); setIsAddPanelOpen(false); } 
    catch (err: any) { alert(`Error: ${err.message}`); } finally { setIsProcessingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const handleAddContent = () => { if (inputText.trim()) { onAddFile(inputText); setInputText(''); setIsAddPanelOpen(false); } };
  const handleExpandNode = async () => { if (!selectedNode) return; setIsGeneratingTopics(true); try { const data = await expandNodeConcepts(selectedNode.title, selectedNode.tags); setExpansionData(data); } catch (e) { console.error(e); } finally { setIsGeneratingTopics(false); } };
  const handleAddSuggestedNode = (topic: string) => { if (!selectedNode) return; const linkTag = `link:${selectedNode.id}`; if (!selectedNode.tags.includes(linkTag)) { onUpdateNode(selectedNode.id, { tags: [...selectedNode.tags, linkTag], connections: (selectedNode.connections || 0) + 1 }); } const newTags = [...new Set([...selectedNode.tags, linkTag])]; const newNode: KnowledgeNode = { id: crypto.randomUUID(), type: 'note', title: topic, tags: newTags, lastAccessed: Date.now(), connections: 1, x: (selectedNode.x || 0) + (Math.random() - 0.5) * 100, y: (selectedNode.y || 0) + (Math.random() - 0.5) * 100, vx: 0, vy: 0, summary: `Auto-generated sub-interest of ${selectedNode.title}` }; onAddNode(newNode); setExpansionData(prev => ({ ...prev, subTopics: prev.subTopics.filter(t => t !== topic) })); };
  const handleSaveContent = () => { if (selectedNode) { onUpdateNode(selectedNode.id, { content: editedContent }); setIsEditingContent(false); } };
  const handleGraphChat = async () => { if (!graphChatInput.trim() || isGraphChatStreaming) return; const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: graphChatInput }; setGraphChatHistory(prev => [...prev, userMsg]); setGraphChatInput(''); setIsGraphChatStreaming(true); const modelMsgId = crypto.randomUUID(); setGraphChatHistory(prev => [...prev, { id: modelMsgId, role: 'model', content: '', isLoading: true }]); await streamChatResponse(graphChatHistory, graphChatInput, (chunk) => { setGraphChatHistory(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: chunk, isLoading: false } : m)); }, mindState, nodes, paths); setIsGraphChatStreaming(false); setGraphChatHistory(current => { const lastMsg = current.find(m => m.id === modelMsgId); if (lastMsg) { const json = extractJSONFromMarkdown(lastMsg.content); if (json && json.type === 'new_note') { const newNode: KnowledgeNode = { id: crypto.randomUUID(), type: 'note', title: json.title, summary: json.summary || "Added by Architect", tags: json.tags || [], content: json.content, lastAccessed: Date.now(), connections: 0, x: -interactionState.current.offset.x, y: -interactionState.current.offset.y }; onAddNode(newNode); } } return current; }); };

  return (
    <div className="relative w-full h-full bg-[#0f172a] overflow-hidden group select-none touch-none">
      
      {/* Legend & Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
         {/* Theme Legend */}
         {mindState?.clusters && (
             <div className="bg-[#1e293b]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-3 mb-2 animate-in fade-in slide-in-from-right-4">
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Cognitive Themes</p>
                 <div className="space-y-1.5">
                     {mindState.clusters.map((c, i) => {
                         const color = `hsl(${(i / mindState.clusters.length) * 360}, 70%, 50%)`;
                         return (
                             <div key={c.id} className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                                 <span className="text-xs text-slate-300 font-medium">{c.themeName}</span>
                             </div>
                         )
                     })}
                 </div>
             </div>
         )}
         
         <div className="flex gap-2">
            <div className="bg-[#1e293b]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl overflow-hidden flex flex-col">
                <button onClick={handleZoomIn} className="p-2.5 text-slate-400 hover:text-white border-b border-white/5 transition-colors"><ZoomIn size={18} /></button>
                <button onClick={handleZoomOut} className="p-2.5 text-slate-400 hover:text-white border-b border-white/5 transition-colors"><ZoomOut size={18} /></button>
                <button onClick={handleResetZoom} className="p-2.5 text-slate-400 hover:text-white transition-colors"><Maximize size={18} /></button>
            </div>
            <div className="flex flex-col gap-2">
                <button onClick={() => setIsAddPanelOpen(!isAddPanelOpen)} className={`p-2.5 rounded-lg border transition-all ${isAddPanelOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#1e293b]/90 border-white/10 text-slate-400 hover:text-white shadow-xl'}`}><Plus size={18} /></button>
                <button onClick={async () => { setIsAnalyzing(true); await onAnalyzeMind().finally(() => setIsAnalyzing(false)); }} disabled={isAnalyzing || nodes.length === 0} className={`p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all ${isAnalyzing ? 'animate-pulse opacity-50' : ''} ${nodes.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}><BrainCircuit size={18} /></button>
                <button onClick={() => setShowChat(!showChat)} className={`p-2.5 rounded-lg border transition-all ${showChat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#1e293b]/90 border-white/10 text-slate-400 hover:text-white shadow-xl'}`}><MessageSquare size={18} /></button>
            </div>
         </div>
      </div>
      
      {/* Trace Mode Banner */}
      {isTracingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 text-white px-6 py-2 rounded-full shadow-xl shadow-indigo-600/20 font-bold flex items-center gap-3 animate-in slide-in-from-top-4">
              <Waypoints size={18} className="animate-pulse"/>
              Select target node to trace path...
              <button onClick={() => { setIsTracingMode(false); setActivePath([]); }} className="hover:bg-white/20 p-1 rounded-full"><X size={14}/></button>
          </div>
      )}

      {/* Connection Tooltip */}
      {hoveredLink && !hoveredNode && !interactionState.current.dragNode && (
          <div 
             className="absolute z-30 bg-black/80 backdrop-blur border border-white/10 text-white text-xs p-2 rounded pointer-events-none"
             style={{ 
                 left: interactionState.current.lastMousePos.x + 15, 
                 top: interactionState.current.lastMousePos.y + 15 
             }}
          >
              <div className="font-bold text-indigo-300 mb-1">Connection Strength: {hoveredLink.weight}/5</div>
              <div className="opacity-70">Shared: {hoveredLink.sharedTerms.join(', ') || 'Tags'}</div>
          </div>
      )}

      <div ref={containerRef} className="w-full h-full">
         <canvas 
            ref={canvasRef} 
            onPointerDown={handlePointerDown} 
            onPointerMove={handlePointerMove} 
            onPointerUp={handlePointerUp} 
            onPointerLeave={handlePointerUp} 
            onWheel={handleWheel} 
            onTouchStart={handleTouchStart} 
            onTouchMove={handleTouchMove} 
            onTouchEnd={handleTouchEnd}
            className="cursor-crosshair w-full h-full block" 
        />
      </div>

      {/* Chat & Add Panels (Identical to previous, kept for XML compactness, assume implied) */}
      {showChat && (
          <div className="absolute bottom-4 left-4 w-80 md:w-96 bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-4 flex flex-col h-96">
              <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2"><Bot size={16} className="text-indigo-400"/> Architect Chat</h3>
                  <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white"><Minimize2 size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-3 pr-1">
                  {graphChatHistory.map(m => {
                       const displayContent = m.content.replace(/```json[\s\S]*?```/g, '').trim();
                       if (!displayContent && !m.isLoading) return null;
                       return (
                           <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                               <div className={`p-3 rounded-xl max-w-[90%] text-xs leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                   <ReactMarkdown>{displayContent || m.content}</ReactMarkdown>
                               </div>
                           </div>
                       )
                  })}
                  <div ref={graphChatEndRef}/>
              </div>
              <div className="flex gap-2">
                  <input type="text" value={graphChatInput} onChange={(e) => setGraphChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGraphChat()} placeholder="Ask to connect or add nodes..." className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <button onClick={handleGraphChat} disabled={isGraphChatStreaming} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-colors"><Send size={16}/></button>
              </div>
          </div>
      )}

      {isAddPanelOpen && (
          <div className="absolute top-4 right-16 w-80 bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl z-20 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><PlusCircle size={14} className="text-indigo-400"/> Add to Brain</h3>
              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Paste thoughts or notes..." className="w-full h-24 bg-[#0f172a] border border-white/10 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4 resize-none" />
              <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2">{isProcessingFile ? <Loader size={12} className="animate-spin"/> : <Upload size={12}/>} Upload (PDF/ZIP/MD)</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.zip,.md,.txt,.json"/>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setIsAddPanelOpen(false)} className="flex-1 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                      <button onClick={handleAddContent} disabled={isProcessingFile} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold shadow-lg transition-all">Analyze & Add</button>
                  </div>
              </div>
          </div>
      )}

      {selectedNode && (
          <div className="absolute top-4 left-4 w-96 bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl z-20 animate-in fade-in slide-in-from-left-4 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
             <div className="flex justify-between items-start mb-4">
                 <div className={`p-2 rounded-lg ${selectedNode.type === 'path' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-teal-500/20 text-teal-300'}`}>
                     {selectedNode.type === 'path' ? <Folder size={18} /> : <FileText size={18} />}
                 </div>
                 <button onClick={() => { setSelectedNode(null); setIsTracingMode(false); setActivePath([]); }} className="text-slate-500 hover:text-white"><X size={16}/></button>
             </div>
             
             <h3 className="text-lg font-bold text-white mb-2 leading-tight">{selectedNode.title}</h3>
             
             {/* Path Actions */}
             <div className="flex gap-2 mb-4">
                 <button 
                    onClick={handleTracePath}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${isTracingMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'}`}
                 >
                     <Waypoints size={14}/> {isTracingMode ? 'Select Target...' : 'Trace Connections'}
                 </button>
             </div>

             {selectedNode.summary && (
                <div className="mb-4 text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed flex gap-2">
                  <Info size={14} className="flex-shrink-0 text-indigo-400 mt-0.5" />
                  {selectedNode.summary}
                </div>
             )}

             <div className="flex flex-wrap gap-2 mb-6">
                 {selectedNode.tags.map(tag => (
                   <span key={tag} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-400">
                     #{tag} {mindState?.interestMatrix?.[tag] ? `(${Math.round(mindState.interestMatrix[tag] * 100)}%)` : ''}
                   </span>
                 ))}
             </div>
             
             {/* Content Editor */}
             <div className="mb-6 border-t border-white/10 pt-4">
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Note Content</p>
                    {isEditingContent ? (
                        <button onClick={handleSaveContent} className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                            <Save size={12}/> Save
                        </button>
                    ) : (
                        <button onClick={() => setIsEditingContent(true)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                            Edit
                        </button>
                    )}
                 </div>
                 
                 {isEditingContent ? (
                     <textarea 
                        value={editedContent} 
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-40 bg-[#0f172a] border border-indigo-500/30 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-scrollbar resize-none font-mono leading-relaxed"
                     />
                 ) : (
                     <div className="w-full max-h-40 overflow-y-auto bg-[#0f172a]/50 border border-white/5 rounded-lg p-3 text-xs text-slate-400 custom-scrollbar whitespace-pre-wrap leading-relaxed">
                         {selectedNode.content || <span className="italic opacity-50">No content...</span>}
                     </div>
                 )}
             </div>

             <div className="mb-6 border-t border-white/10 pt-4">
                 <div className="flex justify-between items-center mb-3">
                    <button onClick={handleExpandNode} disabled={isGeneratingTopics} className="flex-1 bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/20 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                        {isGeneratingTopics ? <Loader size={14} className="animate-spin"/> : <Network size={14} />} Expand Interests
                    </button>
                    {(expansionData.subTopics.length > 0 || expansionData.books.length > 0) && (
                        <button 
                            onClick={() => setExpansionData({ subTopics: [], books: [], videos: [] })}
                            className="ml-2 p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/10"
                            title="Clear Suggestions"
                        >
                            <X size={14} />
                        </button>
                    )}
                 </div>
                 
                 {/* Sub Topics */}
                 {expansionData.subTopics.length > 0 && (
                     <div className="space-y-2 animate-in fade-in slide-in-from-top-2 mb-4">
                         <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Sub-Interests</p>
                         {expansionData.subTopics.map(topic => (
                             <button key={topic} onClick={() => handleAddSuggestedNode(topic)} className="w-full text-left px-3 py-2 rounded-lg bg-[#0f172a] hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 text-slate-300 text-xs flex items-center justify-between group transition-all">
                                 {topic} <Plus size={12} className="opacity-0 group-hover:opacity-100 text-indigo-400"/>
                             </button>
                         ))}
                     </div>
                 )}

                 {/* Books */}
                 {expansionData.books.length > 0 && (
                     <div className="space-y-2 animate-in fade-in slide-in-from-top-2 mb-4">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Recommended Reading</p>
                        {expansionData.books.map((book, i) => (
                             <a key={i} href={`https://www.google.com/search?q=${encodeURIComponent(book)}`} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-100/80 text-xs flex items-center gap-2 transition-all">
                                 <BookOpen size={12} className="text-emerald-400 flex-shrink-0"/> <span className="truncate flex-1">{book}</span> <ExternalLink size={10} className="opacity-50"/>
                             </a>
                        ))}
                     </div>
                 )}
                 {/* Videos */}
                 {expansionData.videos.length > 0 && (
                     <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Video Resources</p>
                        {expansionData.videos.map((vid, i) => (
                             <a key={i} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(vid)}`} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-100/80 text-xs flex items-center gap-2 transition-all">
                                 <MonitorPlay size={12} className="text-red-400 flex-shrink-0"/> <span className="truncate flex-1">{vid}</span> <ExternalLink size={10} className="opacity-50"/>
                             </a>
                        ))}
                     </div>
                 )}
             </div>

             <div className="flex flex-col gap-2 mt-auto">
                 <button onClick={() => onCreateManualPath(selectedNode)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors"><PlusCircle size={14} /> Convert to Commitment</button>
                 <button onClick={() => { onDeleteNode(selectedNode.id); setSelectedNode(null); }} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors"><Trash2 size={14} /> Delete Node</button>
             </div>
          </div>
      )}
    </div>
  );
};