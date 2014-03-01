/*******************************************************
 *******************************************************
 * Utils
 *******************************************************
 ******************************************************/

/**
 * Inheritance
 * This model is based on Douglas Crockford's power constructor
 * With this, function are not constructors anymore, and so the new
 * operator is not needed. We will still use it in our code in case
 * the inheritance model is changed.
 */
function object(o) {
  function F() { };
  if (o) {
    F.prototype = o;
    n = new F();
    n.super = o;
    return n;
  } else {
    return new F();
  }
}

function loadFile(path) {
    var xhr = new XMLHttpRequest;
    xhr.open("get", path, false /* synchronous */);
    xhr.send(null);
    if (xhr.readyState == 4) {
      return text = xhr.responseText;
    }

    return null;
}

function generateArrayWithInitializer(length, generate) {
  var array = new Array(length);
  for (var i = 0; i < length; i++) {
    array[i] = generate();
  }

  return array;
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

/*******************************************************
 *******************************************************
 * Webgl base
 *******************************************************
 ******************************************************/

var gl;
var WebGl = {
  game: null,
  input: new Input(),
  canvas: null,
  init: function() {
    try {
      gl = canvas.getContext("experimental-webgl", { antialias:true });
      if (WebGl.game.width)
        canvas.width = WebGl.game.width;
      if (WebGl.game.height)
        canvas.height = WebGl.game.height;
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
      alert("Could not initialise WebGL");
    }

    var self = WebGl;
    document.onkeydown = function(event) { 
      self.input.onKeyPressed(event.keyCode);
    };
    document.onkeyup = function(event) {
      self.input.onKeyReleased(event.keyCode);
    };
  },

  run: function() {
    setInterval(WebGl.step, 1000/30);
  },

  step: function() {
    WebGl.game.update();
    WebGl.game.render();
  }
}

/**
 * Modelview matrix
 */
var mv = {
  matrixStack: [],
  matrix: mat4.create(),
  pushMatrix: function() {
    var copy = mat4.create();
    mat4.set(mv.matrix, copy);
    mv.matrixStack.push(copy);
  },
  popMatrix: function() {
    if (mv.matrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mat4.set(mv.matrixStack.pop(), mv.matrix);
  },
  resetWithMatrix: function(m) {
    mv.matrixStack = [];
    mv.matrix = m;
  }
}

/**
 * Global projection matrix
 */
var p = {
  matrix: mat4.create(),
  resetWithMatrix: function(m) {
    p.matrix = m;
 }
}

/**
 * Global context matrices
 * To be updated everytime the camera is commited
 */
var global = {
  mv: mv.matrix,
  mvp: mat4.multiply(p.matrix, mv.matrix, mat4.create())
}

/**
 * Lights
 *
 * light.l[i] is { pos, color, (mvpPos) }
 */
var lights = {
  l: []
}

function Shader() {
  var self = object();

  self.program;
  self.attributes = {};
  self.uniforms = {};
  self.color;

  self.init = function(vertPathName, fragPathName) {
    var shadersData = {
      vertex: { 
        type:gl.VERTEX_SHADER,
        dataPath:vertPathName,
        compiledShader:null
      },
      fragment: { 
        type:gl.FRAGMENT_SHADER,
        dataPath:fragPathName,
        compiledShader:null
      }
    };
    for (var type in shadersData) {
      var shaderData = shadersData[type];
      var shader = gl.createShader(shaderData.type);
      var shaderText = loadFile(shaderData.dataPath);
      gl.shaderSource(shader, shaderText);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw gl.getShaderInfoLog(shader);

      shaderData.compiledShader = shader;
    }

    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, shadersData.vertex.compiledShader);
    gl.attachShader(shaderProgram, shadersData.fragment.compiledShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }
    self.program = shaderProgram;
    
    self.attributes = getDefaultAttributes(self.program);
    self.uniforms = getDefaultUniforms(self.program);

    return self;
  }

  self.bind = function() {
    gl.useProgram(self.program);

    // MVP matrices
    gl.uniformMatrix4fv(self.uniforms.pMatrix, false, p.matrix);
    gl.uniformMatrix4fv(self.uniforms.mvMatrix, false, mv.matrix);
    gl.uniformMatrix4fv(self.uniforms.mvpMatrix, false, mat4.multiply(p.matrix, mv.matrix, mat4.create()));
    gl.uniformMatrix4fv(self.uniforms.normalMatrix, false, mat4.transpose(mat4.inverse(mv.matrix, mat4.create())));

    // Lights
    for (var i = 0; i < lights.l.length; i++) {
      gl.uniform3fv(self.uniforms["lightPos" + i], lights.l[i].mvPos);
      gl.uniform3fv(self.uniforms["lightColor" + i], lights.l[i].color);
    }

    // Color
    if (!self.color) {
      self.color = vec3.create([0.598, 0.63, 0.6]);
    }
    gl.uniform3fv(self.uniforms.color, self.color);

    return self;
  }

  // Private declarations
  var getDefaultAttributes = function(program) {
    return {
      vertexPosition: gl.getAttribLocation(program, "aVertexPosition"),
      normalPosition: gl.getAttribLocation(program, "aNormalPosition"),
      texCoord: gl.getAttribLocation(program, "aTexCoord")
    }
  }

  var getDefaultUniforms = function(program) {
    // Scene
    var uniforms = {
      pMatrix: gl.getUniformLocation(program, "uPMatrix"),
      mvMatrix: gl.getUniformLocation(program, "uMVMatrix"), 
      mvpMatrix: gl.getUniformLocation(program, "uMVPMatrix"),
      normalMatrix: gl.getUniformLocation(program, "uNormalMatrix")
    }

    // Light
    for (var i = 0; i < lights.l.length; i++) {
      uniforms["lightPos" + i] = gl.getUniformLocation(self.program, "uLightPos" + i);
      uniforms["lightColor" + i] = gl.getUniformLocation(self.program, "uLightColor" + i);
    }

    uniforms.color = gl.getUniformLocation(program, "uColor");

    return uniforms;
  }

  return self;
}

function Input() {
  var self = object();

  self.keyStates = [];
  self.prevKeyStates = [];
  self.currKeyStates = [];

  self.onKeyPressed = function(keyCode) {
    self.keyStates[keyCode] = true;
    dirtyKeys[nDirtyKeys++] = keyCode;
  };
  self.onKeyReleased = function(keyCode) {
    self.keyStates[keyCode] = false;
    dirtyKeys[nDirtyKeys++] = keyCode;
  };

  self.update = function() {
    var nextNumDirtyKeys = 0;
    for (var i = 0; i < nDirtyKeys; i++) {
      var idx = dirtyKeys[i];
      self.prevKeyStates[idx] = self.currKeyStates[idx];
      self.currKeyStates[idx] = self.keyStates[idx];
      
      // If value has changed, consider them as dirty for next step
      if (self.currKeyStates[idx] ^ self.prevKeyStates[idx]) {
          dirtyKeys[nextNumDirtyKeys++] = idx;
      }
    }
    nDirtyKeys = nextNumDirtyKeys;

    return self;
  }

  self.keyCheck = function(keyCode) {
    return self.currKeyStates[keyCode];
  }

  self.keyPressed = function(keyCode) {
    return self.currKeyStates[keyCode] && !self.prevKeyStates[keyCode];
  }

  self.keyReleased = function(keyCode) {
    return !self.currKeyStates[keyCode] && self.prevKeyStates[keyCode];
  }

  // Private data
  var dirtyKeys = [];
  var nDirtyKeys = 0;

  return self;
}

/*******************************************************
 *******************************************************
 * Geometry
 *******************************************************
 ******************************************************/

function Face() {
  var self = object();

  self.vertexNormalPairs;

  self.init = function(nvertex) {
    self.vertexNormalPairs = generateArrayWithInitializer(nvertex, function() { return {} });
  }

  self.nextVertex = function(idx) {
    return (idx + 1) % self.vertexNormalPairs.length;
  }

  self.computeNormal = function(vertexPool) {
    
    var out = quat4.create(); out[0] = out[1] = out[2] = out[3] = 0;
    for (var i = 0; i < self.vertexNormalPairs.length; i++) {
        var ni = self.nextVertex(i);
        // (yi - suc(yi))*(zi + suc(zi))
        out[0] += (vertexPool[self.vertexNormalPairs[i].vertex][1] - vertexPool[self.vertexNormalPairs[ni].vertex][1]) *
                    (vertexPool[self.vertexNormalPairs[i].vertex][2] + vertexPool[self.vertexNormalPairs[ni].vertex][2]);

        // (zi - suc(zi))*(xi + suc(xi))
        out[1] += (vertexPool[self.vertexNormalPairs[i].vertex][2] - vertexPool[self.vertexNormalPairs[ni].vertex][2]) *
                    (vertexPool[self.vertexNormalPairs[i].vertex][0] + vertexPool[self.vertexNormalPairs[ni].vertex][0]);

        // (xi - suc(xi))*(yi + suc(yi))
        out[2] += (vertexPool[self.vertexNormalPairs[i].vertex][0] - vertexPool[self.vertexNormalPairs[ni].vertex][0]) *
                    (vertexPool[self.vertexNormalPairs[i].vertex][1] + vertexPool[self.vertexNormalPairs[ni].vertex][1]);
    }

   	return out;
  }

  self.computeCenter = function(vertexPool) {
    // TODO: test
    var center = quat4.create(); out[0] = out[1] = out[2] = 0; out[3] = 1;
    var nvertex = self.vertexNormalPairs.length;
    for (var i = 0; i < nvertex; i++) {
        center[0] += vertexPool[self.vertexNormalPairs[i].vertex][0];
        center[1] += vertexPool[self.vertexNormalPairs[i].vertex][1];
        center[2] += vertexPool[self.vertexNormalPairs[i].vertex][2];
    }

    center[0] /= nvertex;
    center[1] /= nvertex;
    center[2] /= nvertex;
        
    return center;
  }

  return self;
}


function Mesh() {
  var self = object();

  self.vertexPool;
  self.normalPool;
  self.faces;
  self.shader;

  self.compiledVertex;
  self.compiledVertexBuffer;

  self.init = function(nvertex, nnormals) {
    self.vertexPool = generateArrayWithInitializer(nvertex, function() { return quat4.create() });
    self.normalPool = generateArrayWithInitializer(nnormals, function() { return quat4.create() });
    self.faces = generateArrayWithInitializer(nnormals, function() { return new Face(); });

    return self;
  }

  self.computeNormals = function() {
    for (var i = 0; i < self.faces.length; i++) {
      self.normalPool[i] = self.faces[i].computeNormal(self.vertexPool);
      for (var j = 0; j < self.faces[i].vertexNormalPairs.length; j++) {
        self.faces[i].vertexNormalPairs[j].normal = i;
      }
    }

    return self;
  }

  self.compile = function(shader) {

    var compiledVertexCount = 0;
    for (var i = 0; i < self.faces.length; i++) {
      for (var j = 0; j < self.faces[i].vertexNormalPairs.length; j++) {
        compiledVertexCount++;
      }
    }

    self.compiledVertex = new Array(compiledVertexCount * 6); // 3 vertex, 3 normal
    var n = 0;
    for (var i = 0; i < self.faces.length; i++) {
        for (var j = 0; j < self.faces[i].vertexNormalPairs.length; j++) {
            var iV = self.faces[i].vertexNormalPairs[j].vertex;
            var iN = self.faces[i].vertexNormalPairs[j].normal;
            for (var k = 0; k < 3; k++) {
                self.compiledVertex[n + k] = self.vertexPool[iV][k];
                self.compiledVertex[n + k + 3] = self.normalPool[iN][k];
            }
            n += 6;
        }
    }

    self.compiledVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, self.compiledVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(self.compiledVertex), gl.STATIC_DRAW);
    self.compiledVertexBuffer.itemSize = 6;
    self.compiledVertexBuffer.numItems = compiledVertexCount;

    self.shader = shader;

    return self;
  }

  self.render = function() {
    if (self.shader) {
      self.shader.bind();

      // Geometry attribs
      gl.bindBuffer(gl.ARRAY_BUFFER, self.compiledVertexBuffer);
      gl.enableVertexAttribArray(self.shader.attributes.vertexPosition);
      gl.enableVertexAttribArray(self.shader.attributes.normalPosition);
      gl.vertexAttribPointer(self.shader.attributes.vertexPosition, 3, gl.FLOAT, false, 6 * 4, 0);
      gl.vertexAttribPointer(self.shader.attributes.normalPosition, 3, gl.FLOAT, false, 6 * 4, 3 * 4);

      gl.drawArrays(gl.TRIANGLES, 0, self.compiledVertexBuffer.numItems);
      
      gl.disableVertexAttribArray(self.shader.attributes.vertexPosition);
      gl.disableVertexAttribArray(self.shader.attributes.normalPosition);
    }

    return self;
  }

  return self;
}

/*******************************************************
 *******************************************************
 * View math
 *******************************************************
 ******************************************************/

function Camera() {
  var self = object();

  self.mvMatrix = mat4.create();
  self.pMatrix = mat4.create();
  self.viewVolume = {};

  self.pitchAngle;
  self.yawAngle;
  self.rollAngle;
  self.pos;

  /**
   * Stablishes this object as the current MVP matrix wrapper
   */
  self.init = function(target) {

    // TODO: set these
    // self.eye = quat4.create([10, 10, 10, 1]);
    // var target = quat4.create([0, 0, 0, 1]);
    // self.lookAt = quat4.create(eye.sub(target));
    // self.focalLength = self.lookAt.module();
    // self.lookAt.normalize();
    
    self.pitchAngle = self.yawAngle = self.rollAngle = 0;
    self.pos = vec3.create();

    self.viewVolume.N = 2;
    self.viewVolume.F = 10000;
    self.viewVolume.xR = 0.2;
    self.viewVolume.xL = - self.viewVolume.xR;
    self.viewVolume.yT = 0.2;
    self.viewVolume.yB = - self.viewVolume.yT;
    var vv = self.viewVolume;

    // mat4.frustum(vv.xL, vv.xR, vv.yT, vv.yB, vv.N, vv.F, p.matrix); // TODO: make this work
    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, self.pMatrix);
    mat4.identity(self.mvMatrix);
    
    if (target) {
      self.lockOn(target);
    }

    return self;
  }

  /* After this call, accessing self.mvMatrix will have the same
   * effect as accessing mv.matrix (same with self.pMatrix and p.matrix)
   */
  self.activate = function() {
    mv.resetWithMatrix(self.mvMatrix);
    p.resetWithMatrix(self.pMatrix);

    return self;
  }

  self.isActive = function() {
    return mv.matrix == self.mvMatrix;
  }

  self.translate = function(t) {
    var m = mat4.create();
    mat4.identity(m);
    mat4.translate(m, t);
    mat4.multiply(m, self.mvMatrix, self.mvMatrix);

    vec3.add(self.pos, t);
    
    return self;
  }

  self.translateX = function(tx) {
    self.translate([tx, 0, 0]);

    return self;
  }

  self.translateY = function(ty) {
    self.translate([0, ty, 0]);

    return self;
  }

  self.translateZ = function(tz) {
    self.translate([0, 0, tz]);

    return self;
  }

  self.pitch = function(alpha) {
    var m = mat4.create();
    mat4.identity(m);
    mat4.rotateX(m, alpha);
    mat4.multiply(m, self.mvMatrix, self.mvMatrix);

    self.pitchAngle += alpha;
    
    return self;
  }

  self.yaw = function(alpha) {
    var m = mat4.create();
    mat4.identity(m);
    mat4.rotateY(m, alpha);
    mat4.multiply(m, self.mvMatrix, self.mvMatrix);

    self.yawAngle += alpha;

    return self;
  }

  self.poleyaw = function(alpha) {
    var m = mat4.create();
    mat4.identity(m);
    mat4.rotateX(m, self.pitchAngle);
    mat4.rotateY(m, alpha);
    mat4.rotateX(m, -self.pitchAngle);
    mat4.multiply(m, self.mvMatrix, self.mvMatrix);

    // uh?
    self.yawAngle += alpha;

    return self;
  }

  self.roll = function(alpha) {
    var m = mat4.create();
    mat4.identity(m);
    mat4.rotateZ(m, alpha);
    mat4.multiply(m, self.mvMatrix, self.mvMatrix);

    self.rollAngle += alpha;

    return self;
  }

  self.lockOn = function(transform) {
    self.target = transform;

    return self;
  }

  self.lockOff = function() {
    self.target = null;

    return self;
  }

  self.commit = function() {
    if (self.target) {
      mat4.inverse(self.target, self.mvMatrix);
      self.translate([0, -5, -5]);
      self.pitch(Math.PI / 4);
    } else {
      // nothing to do here, really
    }

    // Compute global params
    global.mv = mv.matrix;
    global.mvp = mat4.multiply(p.matrix, mv.matrix, global.mvp);

    // Lights
    for (var i = 0; i < lights.l.length; i++) {
      lights.l[i].mvPos = mat4.multiplyVec3(global.mv, lights.l[i].pos, vec3.create());
      lights.l[i].mvpPos = mat4.multiplyVec3(global.mvp, lights.l[i].pos, vec3.create());
    }

    return self;
  }

  return self;
}


/*******************************************************
 *******************************************************
 * Game arquitecture
 *******************************************************
 ******************************************************/

function Game() {
  var self = object();

  self.width;
  self.height;
  self.world;
  self.input;

  self.initSettings = function() {
    self.width = 640;
    self.height = 480;

    return self;
  }
    
  self.init = function(canvas) {
    self.initSettings();
    WebGl.game = self;
    WebGl.canvas = self;
    WebGl.init();
    self.input = WebGl.input;

    return self;

  }

  self.update = function() {
    self.input.update();
    self.world.update();

    return self;
  }

  self.render = function() {
    self.world.render();

    return self;
  }

  self.changeWorld = function(world) {
    world.init(self);
    self.world = world;

    return self;
  }

  self.run = function() {
    WebGl.run();

    return self;
  }

  return self;
}

function GameState() {
  var self = object();

  self.game;
  self.camera;
  self.init = function(game) {
    self.game = game;
    self.camera = new Camera();

    return self;
  }

  self.update = function() {
    return self;
  }

  self.render = function() {
    self.camera.commit();
    return self;
  }

  return self;
}

function Entity() {
  var self = object();

  self.game;
  self.world;
  self.transform;
  self.mesh;
  self.shader;

  self.pitchAngle;
  self.yawAngle;
  self.rollAngle;
  self.pos;

  self.init = function(game, world) {
    self.game = game;
    self.world = world;
    self.transform = mat4.create();
    mat4.identity(self.transform);

    self.pitchAngle = self.yawAngle = self.rollAngle = 0;
    self.pos = vec3.create();

    return self;
  }

  self.update = function() {
    return self;
  }

  self.render = function() {
    mv.pushMatrix();
      mat4.multiply(mv.matrix, self.transform, mv.matrix);

      if (self.mesh) {
        self.mesh.render();
      }

    mv.popMatrix();

    return self;
  }

  self.translate = function(t) {
    mat4.translate(self.transform, t);
    vec3.add(self.pos, t);

    return self;
  }

  self.translateX = function(tx) {
    self.translate([tx, 0, 0]);

    return self;
  }

  self.translateY = function(ty) {
    self.translate([0, ty, 0]);

    return self;
  }

  self.translateZ = function(tz) {
    self.translate([0, 0, tz]);

    return self;
  }

  self.pitch = function(alpha) {
    mat4.rotateX(self.transform, alpha);
    self.pitchAngle += alpha;

    return self;
  }

  self.poleyaw = function(alpha) {
    mat4.rotateX(self.transform, -self.pitchAngle);
    mat4.rotateY(self.transform, alpha);
    mat4.rotateX(self.transform, self.pitchAngle);

    // uh?
    self.yawAngle += alpha;

    return self;
  }

  self.yaw = function(alpha) {
    mat4.rotateY(self.transform, alpha);
    self.yawAngle += alpha;

    return self;
  }

  self.roll = function(alpha) {
    mat4.rotateZ(self.transform, alpha);
    self.rollAngle += alpha;

    return self;
  }

  self.orbitate = function() {
    // TODO
    return self;
  }  

  return self;

}

/*******************************************************
 *******************************************************
 * Game implementation
 *******************************************************
 ******************************************************/

function GameApp() {
  var self = object(new Game());
  
  self.initSettings = function() {
    self.width = 640;
    self.height = 480;

    return self;
  }

  self.init = function() {
    self.super.init();

    self.changeWorld(new Level());

    return self;
  }

  self.update = function() {
    self.super.update();

    return self;
  }

  return self;
}

function Level() {
  var self = object(new GameState());

  self.player = new Player();
  self.levelCamera;
  self.playerCamera;

  self.lightPos;

  self.init = function(game) {
    self.super.init(game);

    // Camera setup
    self.playerCamera = new Camera().init();
    self.camera.init().translate([-10, -10, -10]).pitch(Math.PI / 4).poleyaw(-Math.PI / 4).activate();
    self.levelCamera = self.camera;

    // Scene setup
    lights.l[0] = {
      pos: vec3.create([0.0, 5.0, 0.0]),
      color: vec3.create([1.0, 1.0, 0.95])
    }

    // Entities setup
    self.player.init(self.game, self);

    // Shaders
    var shader = new Shader().init("shaderTexture.vs", "shaderTexture.fs");
    shaderProgram = shader;
    shaderProgram.color = vec3.create([1.0, 1.0, 0.8]);

    // // Buffers
    tmpBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tmpBuffer);
    
    // Grid
    var vertices = [
      -20, -5, -20, 0, 1, 0, 20.0, 0.0,
      20, -5, -20, 0, 1, 0, 0.0, 0.0,
      -20, -5, 20, 0, 1, 0, 20.0, 20.0,
      20, -5, -20, 0, 1, 0, 0.0, 0.0,
      -20, -5, 20, 0, 1, 0, 20.0, 20.0,
      20, -5, 20, 0, 1, 0, 0.0, 20.0
    ];

    floorTexture = gl.createTexture();
    floorTexture.image = new Image();
    floorTexture.image.onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, floorTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floorTexture.image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.bindTexture(gl.TEXTURE_2D, null);

      shaderProgram.uniforms.texture0 = gl.getUniformLocation(shaderProgram.program, "uTexSampler0");
    }
    floorTexture.image.src = "floortile.png";

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    tmpBuffer.itemSize = 8;
    tmpBuffer.numItems = vertices.length / tmpBuffer.itemSize;

    return self;
  }

  self.update = function() {
    self.super.update();

    if (self.levelCamera.isActive()) {
      var x = 0, y = 0;
      if (self.game.input.keyCheck(87)) {  // w
        y += 0.1;
      }
      if (self.game.input.keyCheck(65)) {  // a
        x += 0.1;
      }
      if (self.game.input.keyCheck(83)) {  // s
        y -= 0.1;
      }
      if (self.game.input.keyCheck(68)) {  // d
        x -= 0.1;
      }

      var yaw = 0, pitch = 0;
      if (self.game.input.keyCheck(37)) {  // left
        yaw -= 0.07;
      }
      if (self.game.input.keyCheck(38)) {  // up
        pitch += 0.07;
      }
      if (self.game.input.keyCheck(39)) {  // right
        yaw += 0.07;
      }
      if (self.game.input.keyCheck(40)) {  // down
        pitch -= 0.07;
      }

      self.camera.translate([x, 0, y]).poleyaw(yaw).pitch(-pitch);
    }

    if (self.game.input.keyPressed(80)) {  // p
      toggleCamera();
    }

    self.player.update();

    return self;
  }

  self.render = function() {
    self.super.render();
 
    // Clear view
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mv.pushMatrix();
      shaderProgram.bind();
      gl.enableVertexAttribArray(shaderProgram.attributes.vertexPosition);
      gl.enableVertexAttribArray(shaderProgram.attributes.normalPosition);

      gl.bindBuffer(gl.ARRAY_BUFFER, tmpBuffer);
      gl.vertexAttribPointer(shaderProgram.attributes.vertexPosition, 3, gl.FLOAT, false, tmpBuffer.itemSize*4, 0);
      gl.vertexAttribPointer(shaderProgram.attributes.normalPosition, 3, gl.FLOAT, false, tmpBuffer.itemSize*4, 3*4);
      if (shaderProgram.attributes.texCoord >= 0) {
        gl.enableVertexAttribArray(shaderProgram.attributes.texCoord);
        gl.vertexAttribPointer(shaderProgram.attributes.texCoord, 2, gl.FLOAT, false, tmpBuffer.itemSize*4, 6*4);
      
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, floorTexture);
        gl.uniform1i(shaderProgram.uniforms.texture0, 0);
      }

      gl.drawArrays(gl.TRIANGLES, 0, tmpBuffer.numItems);

      gl.disableVertexAttribArray(shaderProgram.attributes.vertexPosition);
      gl.disableVertexAttribArray(shaderProgram.attributes.normalPosition);
      if (shaderProgram.attributes.texCoord >= 0) {
        gl.disableVertexAttribArray(shaderProgram.attributes.texCoord);
      }

    mv.popMatrix();
    
    self.player.render();

    return self;
  }

  // Private
  var tmpBuffer;

  var toggleCamera = function() {
    if (self.camera == self.levelCamera) {
      self.playerCamera.lockOn(self.player.transform);
      self.super.camera = self.playerCamera;
    } else {
      self.super.camera = self.levelCamera;
    }
  
    self.super.camera.activate();
  }

  return self;
}

function Player() {
  var self = object(new Entity());

  self.init = function(game, world) {
    self.super.init(game, world);

    var shader = new Shader();
    shader.init("shader.vs", "shader.fs");
    shader.color = vec3.create([0.34, 0.32, 1.0]);

    // Create mesh (cube)
    var m = new Mesh().init(8, 12);
    m.vertexPool[0] = quat4.create([-0.5, -0.5, -0.5, 1]);
    m.vertexPool[1] = quat4.create([-0.5, -0.5, 0.5, 1]);
    m.vertexPool[2] = quat4.create([-0.5, 0.5, -0.5, 1]);
    m.vertexPool[3] = quat4.create([-0.5, 0.5, 0.5, 1]);
    m.vertexPool[4] = quat4.create([0.5, -0.5, -0.5, 1]);
    m.vertexPool[5] = quat4.create([0.5, -0.5, 0.5, 1]);
    m.vertexPool[6] = quat4.create([0.5, 0.5, -0.5, 1]);
    m.vertexPool[7] = quat4.create([0.5, 0.5, 0.5, 1]);

    m.faces[0].init(3);
    m.faces[0].vertexNormalPairs[0].vertex = 4;
    m.faces[0].vertexNormalPairs[1].vertex = 6;
    m.faces[0].vertexNormalPairs[2].vertex = 5;
    m.faces[1].init(3);
    m.faces[1].vertexNormalPairs[0].vertex = 5;
    m.faces[1].vertexNormalPairs[1].vertex = 6;
    m.faces[1].vertexNormalPairs[2].vertex = 7;

    m.faces[2].init(3);
    m.faces[2].vertexNormalPairs[0].vertex = 6;
    m.faces[2].vertexNormalPairs[1].vertex = 2;
    m.faces[2].vertexNormalPairs[2].vertex = 7;
    m.faces[3].init(3);
    m.faces[3].vertexNormalPairs[0].vertex = 7;
    m.faces[3].vertexNormalPairs[1].vertex = 2;
    m.faces[3].vertexNormalPairs[2].vertex = 3;

    m.faces[4].init(3);
    m.faces[4].vertexNormalPairs[0].vertex = 2;
    m.faces[4].vertexNormalPairs[1].vertex = 0;
    m.faces[4].vertexNormalPairs[2].vertex = 3;
    m.faces[5].init(3);
    m.faces[5].vertexNormalPairs[0].vertex = 3;
    m.faces[5].vertexNormalPairs[1].vertex = 0;
    m.faces[5].vertexNormalPairs[2].vertex = 1;

    m.faces[6].init(3);
    m.faces[6].vertexNormalPairs[0].vertex = 0;
    m.faces[6].vertexNormalPairs[1].vertex = 4;
    m.faces[6].vertexNormalPairs[2].vertex = 1;
    m.faces[7].init(3);
    m.faces[7].vertexNormalPairs[0].vertex = 1;
    m.faces[7].vertexNormalPairs[1].vertex = 4;
    m.faces[7].vertexNormalPairs[2].vertex = 5;

    m.faces[8].init(3);
    m.faces[8].vertexNormalPairs[0].vertex = 7;
    m.faces[8].vertexNormalPairs[1].vertex = 3;
    m.faces[8].vertexNormalPairs[2].vertex = 5;
    m.faces[9].init(3);
    m.faces[9].vertexNormalPairs[0].vertex = 5;
    m.faces[9].vertexNormalPairs[1].vertex = 3;
    m.faces[9].vertexNormalPairs[2].vertex = 1;

    m.faces[10].init(3);
    m.faces[10].vertexNormalPairs[0].vertex = 4;
    m.faces[10].vertexNormalPairs[1].vertex = 0;
    m.faces[10].vertexNormalPairs[2].vertex = 6;
    m.faces[11].init(3);
    m.faces[11].vertexNormalPairs[0].vertex = 6;
    m.faces[11].vertexNormalPairs[1].vertex = 0;
    m.faces[11].vertexNormalPairs[2].vertex = 2;

    m.computeNormals().compile(shader);

    self.super.mesh = m;

    return self;
  }

  self.update = function() {
    self.super.update();

    var x = 0, y = 0;
    var tinc = 0.5;
    if (self.game.input.keyCheck(87)) {  // w
      y -= tinc;
    }
    if (self.game.input.keyCheck(65)) {  // a
      x -= tinc;
    }
    if (self.game.input.keyCheck(83)) {  // s
      y = tinc;
    }
    if (self.game.input.keyCheck(68)) {  // d
      x = tinc;
    }

    var yaw = 0, pitch = 0;
    var rinc = 0.07;
    if (self.game.input.keyCheck(37)) {  // left
      yaw += rinc;
    }
    if (self.game.input.keyCheck(38)) {  // up
      pitch -= rinc;
    }
    if (self.game.input.keyCheck(39)) {  // right
      yaw -= rinc;
    }
    if (self.game.input.keyCheck(40)) {  // down
      pitch += rinc;
    }
    var idlation = 0.03*Math.sin(0.1*i);
    i++;

    if (self.world.camera != self.world.levelCamera) {
      self.poleyaw(yaw).pitch(-pitch).translate([x, idlation, y]);
    } else {
      self.translate([0, idlation, 0]);
    }      

    return self;
  }


  // Private
  var i = 0;

  return self;
}

/*******************************************************
 *******************************************************
 * Main
 *******************************************************
 ******************************************************/

function main() {
    var canvas = document.getElementById("canvas");

    game = new GameApp().init(canvas).run();
}
