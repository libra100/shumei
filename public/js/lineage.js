firebase.initializeApp({
  apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
  authDomain: 'shumei-2025.firebaseapp.com',
  databaseURL: 'https://shumei-2025.firebaseio.com',
  projectId: 'shumei-2025',
});
const db = firebase.firestore();
const auth = firebase.auth();

function signOut() {
  auth.signOut().then(() => {
    window.location.href = '/index.html';
  });
}

// Globals
let graphData = { nodes: [], links: [] };
let nodeMap = new Map();
let Graph;

// Polyfill for 3d-force-graph compatibility with newer THREE.js
if (typeof THREE !== 'undefined' && !THREE.Object3D.prototype.applyMatrix) {
  THREE.Object3D.prototype.applyMatrix = THREE.Object3D.prototype.applyMatrix4;
}

// Fetch and process data
async function initData() {
  try {
    const snapshot = await db.collection('member').get();
    const members = [];
    snapshot.forEach(doc => {
      members.push({ id: doc.id, ...doc.data() });
    });

    processGraphData(members);
    
    // Debug overlay
    const debugDiv = document.createElement('div');
    debugDiv.style.position = 'fixed';
    debugDiv.style.bottom = '90px';
    debugDiv.style.left = '20px';
    debugDiv.style.color = '#fff';
    debugDiv.style.zIndex = '9999';
    debugDiv.style.pointerEvents = 'none';
    debugDiv.style.fontSize = '12px';
    debugDiv.style.textShadow = '0 0 5px rgba(0,0,0,0.8)';
    debugDiv.innerHTML = `Members: ${members.length}<br>Nodes: ${graphData.nodes.length}<br>Links: ${graphData.links.length}`;
    document.body.appendChild(debugDiv);

    initGraph();
    populateNavDrawer();
    
    // Hide loading
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);

  } catch (error) {
    console.error("Error fetching data:", error);
    alert("資料載入失敗: " + error.message);
  }
}

// 3D Canvas Text Sprite for Mobile & Desktop Labeling
function createTextSprite(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  
  ctx.font = 'Bold 26px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Background shadow for 3D visibility
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(24, 6, 1);
  sprite.position.set(0, 8, 0); // Position text above node sphere
  return sprite;
}

function processGraphData(members) {
  const nodes = [];
  const links = [];
  const nodeLookup = new Set();
  
  // 1. Add all known members as nodes
  members.forEach(m => {
    // Member Name or ID
    const name = m.name || m.id;
    // We use Name as ID since guides are stored as names
    const nodeId = name;
    
    if (!nodeLookup.has(nodeId)) {
      nodeLookup.add(nodeId);
      nodes.push({
        id: nodeId,
        name: name,
        realId: m.id,
        isKnown: true,
        data: m,
        val: 1.5 // Size
      });
      nodeMap.set(nodeId, nodes[nodes.length - 1]);
    }
  });

  // 2. Process links and unknown guides
  members.forEach(m => {
    const targetId = m.name || m.id;
    
    if (m.guide && Array.isArray(m.guide)) {
      m.guide.forEach((g, index) => {
        if (typeof g === 'string' && g.trim() !== '') {
          const guideName = g.trim();
          
          // If guide doesn't exist in our nodes, create an "unknown" node
          if (!nodeLookup.has(guideName)) {
            nodeLookup.add(guideName);
            nodes.push({
              id: guideName,
              name: guideName,
              isKnown: false,
              val: 1 // Smaller size
            });
            nodeMap.set(guideName, nodes[nodes.length - 1]);
          }
          
          // Create link from guide (source) to member (target)
          links.push({
            source: guideName,
            target: targetId,
            type: 'guide',
            guideIndex: index
          });
        }
      });
    }
  });

  // Collect set of all sewajin names across members
  const sewajinSet = new Set();
  members.forEach(m => {
    if (m.sewajin && typeof m.sewajin === 'string' && m.sewajin.trim() !== '') {
      sewajinSet.add(m.sewajin.trim());
    }
  });

  // Calculate link counts and set isSewajin flag
  // Calculate link counts, set isSewajin flag, and assign 3D initial offsets so sibling nodes separate in 3D
  nodes.forEach(n => {
    n.linkCount = 0;
    n.isSewajin = sewajinSet.has(n.name) || (n.data && (n.data.part === '世話人' || n.data.role === '世話人' || n.data.isSewajin));
    if (n.isSewajin) {
      n.val = 2.2; // Slightly larger size for Sewajin
    }
    // Give initial random 3D positions to break collinearity between sibling nodes
    n.x = (Math.random() - 0.5) * 200;
    n.y = (Math.random() - 0.5) * 200;
    n.z = (Math.random() - 0.5) * 200;
  });

  links.forEach(l => {
    const sourceNode = nodeMap.get(l.source);
    const targetNode = nodeMap.get(l.target);
    if (sourceNode) sourceNode.linkCount++;
    if (targetNode) targetNode.linkCount++;
  });

  graphData = { nodes, links };
}

function initGraph() {
  const elem = document.getElementById('3d-graph');
  
  Graph = ForceGraph3D()(elem)
    .nodeLabel('name')
    .nodeColor(node => node.isSewajin ? '#00F3FF' : (node.isKnown ? '#FFA100' : '#555555'))
    .nodeVal('val')
    .nodeRelSize(6)
    .linkWidth(link => link.guideIndex === 0 ? 1.5 : 0.8)
    .linkCurvature(link => link.guideIndex === 0 ? 0.08 : (link.guideIndex % 2 === 0 ? 0.25 : -0.25))
    .linkColor(link => link.guideIndex === 0 ? 'rgba(0, 243, 255, 0.6)' : 'rgba(255, 100, 200, 0.8)')
    .linkDirectionalParticles(link => link.guideIndex === 0 ? 3 : 2)
    .linkDirectionalParticleWidth(link => link.guideIndex === 0 ? 2.5 : 1.5)
    .linkDirectionalParticleColor(link => link.guideIndex === 0 ? '#00F3FF' : '#FF64C8')
    .linkDirectionalParticleSpeed(0.005)
    .backgroundColor('#050510')
    .nodeThreeObject(node => {
      const isSewajin = node.isSewajin;
      const isKnown = node.isKnown;
      const colorHex = isSewajin ? 0x00F3FF : (isKnown ? 0xFFA100 : 0x555555);
      
      const geometry = new THREE.SphereGeometry(node.val * 3, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: colorHex,
        transparent: true,
        opacity: isKnown ? 0.95 : 0.4,
        shininess: 100
      });
      const sphere = new THREE.Mesh(geometry, material);

      if (isSewajin) {
        // Glowing halo sphere for Sewajin
        const glowGeometry = new THREE.SphereGeometry(node.val * 4.8, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00F3FF,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        sphere.add(glowSphere);
      } else if (isKnown) {
        // Soft aura for regular members
        const glowGeometry = new THREE.SphereGeometry(node.val * 3.8, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xFFA100,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        sphere.add(glowSphere);
      }

      // Always add 3D canvas text sprite so names are clear on mobile without hover
      const textColor = isSewajin ? '#00F3FF' : (isKnown ? '#FFFFFF' : '#888888');
      const labelText = node.name + (isSewajin ? ' (世話人)' : '');
      const labelSprite = createTextSprite(labelText, textColor);
      sphere.add(labelSprite);

      return sphere;
    })
    .onNodeHover(node => {
      elem.style.cursor = node ? 'pointer' : null;
    })
    .onNodeClick(node => {
      flyToNode(node);
    })
    .graphData(graphData);

  // Add lighting
  const scene = Graph.scene();
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 100);
  scene.add(directionalLight);

  // Set link distance to give more breathing room
  Graph.d3Force('link').distance(110);

  // Increase charge repulsion strength so sibling nodes with identical connections push apart in 3D
  Graph.d3Force('charge').strength(-900).distanceMax(600);

  // Mobile tap fallback
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;

  elem.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartTime = Date.now();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  elem.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const timeElapsed = Date.now() - touchStartTime;

      if (dist < 10 && timeElapsed < 300) {
        const rect = elem.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Graph.camera());
        const intersects = raycaster.intersectObjects(Graph.scene().children, true);
        
        for (let i = 0; i < intersects.length; i++) {
          let obj = intersects[i].object;
          while (obj && !obj.__data) {
            obj = obj.parent;
          }
          if (obj && obj.__data && obj.__data.name) {
            flyToNode(obj.__data);
            break;
          }
        }
      }
    }
  }, { passive: true });
}

function flyToNode(node) {
  if (!node || !Graph) return;
  const distance = 60;
  const distRatio = 1 + distance / Math.hypot(node.x || 0.1, node.y || 0.1, node.z || 0.1);
  Graph.cameraPosition(
    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
    node, 
    2000
  );
  showNodeDetail(node);
}

function handleSearch(event) {
  const query = event.target.value.trim().toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  
  if (query.length === 0) {
    resultsContainer.style.display = 'none';
    return;
  }
  
  // Find matching nodes, prioritizing known members over unfiled guides
  const matches = graphData.nodes
    .filter(n => n.name && n.name.toLowerCase().includes(query))
    .sort((a, b) => (b.isKnown ? 1 : 0) - (a.isKnown ? 1 : 0))
    .slice(0, 15);
  
  if (matches.length > 0) {
    resultsContainer.innerHTML = '';
    matches.forEach(m => {
      const div = document.createElement('div');
      div.style.padding = '10px 15px';
      div.style.cursor = 'pointer';
      div.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      div.style.color = '#fff';
      div.innerHTML = `${m.name} <span class="badge ${m.isKnown ? 'bg-info text-dark' : 'bg-secondary'}" style="font-size: 10px; margin-left: 6px;">${m.isKnown ? '已建檔' : '未建檔'}</span>`;
      
      div.onmouseover = () => { div.style.background = 'rgba(0,243,255,0.2)'; };
      div.onmouseout = () => { div.style.background = 'transparent'; };
      
      div.onmousedown = (e) => {
        // Use mousedown instead of click to fire before blur hides the dropdown
        e.preventDefault(); 
        flyToNode(m);
        resultsContainer.style.display = 'none';
        document.getElementById('search-node').value = m.name;
      };
      
      resultsContainer.appendChild(div);
    });
    resultsContainer.style.display = 'block';
  } else {
    resultsContainer.innerHTML = '<div style="padding: 10px 15px; color: rgba(255,255,255,0.5);">找不到符合的成員</div>';
    resultsContainer.style.display = 'block';
  }
}

// UI Overlay logic
function showNodeDetail(node) {
  const panel = document.getElementById('node-detail-panel');
  document.getElementById('detail-name').innerText = node.name;
  
  if (node.isKnown && node.data) {
    const d = node.data;
    document.getElementById('detail-part').innerText = d.part || '未知';
    document.getElementById('detail-part').className = `badge ${d.part === '大學生' ? 'bg-primary' : 'bg-secondary'}`;
    document.getElementById('detail-connect').innerText = d.connect ? '可接觸' : '不可接觸';
    document.getElementById('detail-connect').className = `badge ${d.connect ? 'bg-info text-dark' : 'bg-dark'}`;
    
    document.getElementById('detail-guide').innerText = (d.guide && d.guide[0]) ? d.guide.join(', ') : '無';
    document.getElementById('detail-join').innerText = node.realId ? node.realId.split('A')[0] : '無';
    document.getElementById('detail-sewa').innerText = d.sewajin || '無';
    document.getElementById('detail-leader').innerText = d.leader || '無';
    document.getElementById('detail-note').innerText = d.note || '無特別備註';
  } else {
    // Unknown node
    document.getElementById('detail-part').innerText = '無資料';
    document.getElementById('detail-part').className = 'badge bg-secondary';
    document.getElementById('detail-connect').innerText = '未建檔';
    document.getElementById('detail-connect').className = 'badge bg-dark';
    
    document.getElementById('detail-guide').innerText = '-';
    document.getElementById('detail-join').innerText = '-';
    document.getElementById('detail-sewa').innerText = '-';
    document.getElementById('detail-leader').innerText = '-';
    document.getElementById('detail-note').innerText = '此人為某位成員的介紹人，但尚未在系統中建立詳細資料。';
  }

  panel.classList.add('active');
}

function closeNodeDetail() {
  document.getElementById('node-detail-panel').classList.remove('active');
}

// Mobile Touch Controls & Navigation Drawer Functions
function zoomGraph(factor) {
  if (!Graph) return;
  const currentPos = Graph.cameraPosition();
  if (currentPos) {
    Graph.cameraPosition(
      { x: currentPos.x * factor, y: currentPos.y * factor, z: currentPos.z * factor },
      null,
      400
    );
  }
}

let isAutoRotating = false;
let rotateInterval = null;

function toggleAutoRotate() {
  if (!Graph) return;
  isAutoRotating = !isAutoRotating;
  
  const controls = Graph.controls();
  if (controls) {
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 2.5;
  }

  if (isAutoRotating) {
    if (typeof Graph.resumeAnimation === 'function') {
      Graph.resumeAnimation();
    }
    // Backup camera rotation loop
    let angle = Math.atan2(Graph.cameraPosition().x || 1, Graph.cameraPosition().z || 1);
    if (rotateInterval) clearInterval(rotateInterval);
    rotateInterval = setInterval(() => {
      if (!isAutoRotating || !Graph) {
        clearInterval(rotateInterval);
        return;
      }
      angle += 0.015;
      const pos = Graph.cameraPosition();
      const radius = Math.hypot(pos.x, pos.z) || 350;
      Graph.cameraPosition({
        x: radius * Math.sin(angle),
        y: pos.y,
        z: radius * Math.cos(angle)
      });
    }, 30);
  } else {
    if (rotateInterval) {
      clearInterval(rotateInterval);
      rotateInterval = null;
    }
  }

  const btn = document.getElementById('btn-rotate');
  if (btn) {
    btn.classList.toggle('active', isAutoRotating);
  }
}

function recenterGraph() {
  if (!Graph) return;
  if (rotateInterval) {
    clearInterval(rotateInterval);
    rotateInterval = null;
    isAutoRotating = false;
    const btn = document.getElementById('btn-rotate');
    if (btn) btn.classList.remove('active');
  }
  const controls = Graph.controls();
  if (controls) {
    controls.autoRotate = false;
  }
  
  // Smoothly move camera back to overview distance
  Graph.cameraPosition({ x: 0, y: 0, z: 350 }, { x: 0, y: 0, z: 0 }, 1000);
  if (typeof Graph.zoomToFit === 'function') {
    Graph.zoomToFit(1000, 40);
  }
  closeNodeDetail();
}

function toggleNavDrawer() {
  const drawer = document.getElementById('nav-drawer-overlay');
  if (drawer) {
    drawer.classList.toggle('active');
  }
}

function populateNavDrawer() {
  const container = document.getElementById('drawer-member-list');
  if (!container) return;
  container.innerHTML = '';

  // Group members by leader
  const groups = {};
  graphData.nodes.forEach(node => {
    const leader = (node.data && node.data.leader) ? node.data.leader : (node.isKnown ? '未分組' : '介紹人 (非建檔)');
    if (!groups[leader]) groups[leader] = [];
    groups[leader].push(node);
  });

  // Sort group titles: put '未分組' and '未建檔' at the very end
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const isSpecialA = a.includes('未建檔') || a.includes('非建檔') || a === '未分組';
    const isSpecialB = b.includes('未建檔') || b.includes('非建檔') || b === '未分組';
    
    if (isSpecialA && !isSpecialB) return 1;
    if (!isSpecialA && isSpecialB) return -1;
    return a.localeCompare(b, 'zh-Hant');
  });

  groupKeys.forEach(leaderName => {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'drawer-group-title';
    titleDiv.innerText = `👥 ${leaderName} (${groups[leaderName].length} 人)`;
    container.appendChild(titleDiv);

    // Sort nodes within group: known members first, unfiled last
    groups[leaderName].sort((a, b) => {
      if (a.isKnown !== b.isKnown) return b.isKnown ? 1 : -1;
      return a.name.localeCompare(b.name, 'zh-Hant');
    }).forEach(node => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'drawer-item';
      itemDiv.innerHTML = `
        <span style="font-weight: 500; font-size: 14px;">${node.name}</span>
        <span class="badge ${node.isKnown ? (node.data && node.data.part === '大學生' ? 'bg-primary' : 'bg-info text-dark') : 'bg-secondary'}" style="font-size: 11px;">
          ${node.isKnown ? (node.data && node.data.part || '成員') : '未建檔'}
        </span>
      `;
      itemDiv.onclick = () => {
        toggleNavDrawer();
        flyToNode(node);
      };
      container.appendChild(itemDiv);
    });
  });
}

// Window resize
window.addEventListener('resize', () => {
  if (Graph) {
    Graph.width(window.innerWidth).height(window.innerHeight);
  }
});

// Start
auth.onAuthStateChanged((user) => {
  if (user) {
    initData();
  } else {
    // 未登入，導回首頁
    window.location.href = '/index.html';
  }
});
