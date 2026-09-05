import { computeQuadMatrix } from "./transform";
import type { ClipTransform } from "@/types/timeline";

const VERTEX_SHADER_SOURCE = `#version 300 es
uniform mat3 u_matrix;
out vec2 v_texCoord;

const vec2 positions[4] = vec2[4](
  vec2(-0.5, -0.5),
  vec2( 0.5, -0.5),
  vec2(-0.5,  0.5),
  vec2( 0.5,  0.5)
);

void main() {
  vec2 local = positions[gl_VertexID];
  vec3 clipPos = u_matrix * vec3(local, 1.0);
  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
  v_texCoord = vec2(local.x + 0.5, 0.5 - local.y);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform float u_opacity;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  outColor = vec4(color.rgb, color.a * u_opacity);
}
`;

export interface CompositeLayer {
  /** Decoded video frame (or any CanvasImageSource-compatible texture source) to draw. */
  source: VideoFrame;
  zIndex: number;
  opacity: number;
  transform: ClipTransform;
  sourceWidth: number;
  sourceHeight: number;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log ?? "unknown"}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log ?? "unknown"}`);
  }
  return program;
}

/**
 * Draws decoded VideoFrames onto an OffscreenCanvas as a stack of textured quads, one per
 * visible clip, back-to-front by zIndex — this is what makes multi-track picture-in-picture and
 * overlays possible: each track's frame is just another layer in the same draw loop.
 */
export class WebGLCompositor {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly matrixLocation: WebGLUniformLocation;
  private readonly opacityLocation: WebGLUniformLocation;

  constructor(private readonly canvas: OffscreenCanvas) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 is not available in this context");
    this.gl = gl;

    this.program = linkProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    const matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    const opacityLocation = gl.getUniformLocation(this.program, "u_opacity");
    if (!matrixLocation || !opacityLocation) throw new Error("Failed to locate shader uniforms");
    this.matrixLocation = matrixLocation;
    this.opacityLocation = opacityLocation;

    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create texture");
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  render(layers: CompositeLayer[]): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of sorted) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.source);

      const matrix = computeQuadMatrix(
        layer.transform,
        layer.sourceWidth,
        layer.sourceHeight,
        this.canvas.width,
        this.canvas.height,
      );
      gl.uniformMatrix3fv(this.matrixLocation, false, matrix);
      gl.uniform1f(this.opacityLocation, layer.opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
  }
}
