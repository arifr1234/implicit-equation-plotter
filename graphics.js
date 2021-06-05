function getShader(url)
{
    return new Promise(function (resolve, reject) {
        var client = new XMLHttpRequest();
        client.onreadystatechange = function() {
            if(client.readyState === 4)
            {
                resolve(client.responseText);
            }
        }
        client.open('GET', url);
        client.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");  // TODO: Remove.
        client.send();
    })
}

function concat(...shaders)
{
    return `#version 300 es\n${shaders.join("\n")}`;
}

const gl = document.getElementById("c").getContext("webgl2");
const ext = gl.getExtension('EXT_color_buffer_float');

const arrays = {
    //position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
    position: [-1, -1, 0, 3, -1, 0, -1, 3, 0],
};
const vertexBufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);


const attachments = [
    { format: gl.RGBA, internalFormat: gl.RGBA32F, type: gl.FLOAT, mag: gl.NEAREST, min: gl.NEAREST },
    { format: gl.DEPTH_STENCIL }
];


let commonFs = null;
let imageFs = null;
let bufferAFs = null;
let selectMinFs = null;

const loadShaders = Promise.all([getShader(String.raw`shaders\common.fs`), getShader(String.raw`shaders\image.fs`), getShader(String.raw`shaders\bufferA.fs`), getShader(String.raw`shaders\selectMin.fs`)])
.then(values => {
    [commonFs, imageFs, bufferAFs, selectMinFs] = values;
});

const GlslErrors = document.getElementById("GlslErrors");

class ImplicitSurface
{
    deleteObj()
    {
        this.halt = true;

        requestAnimationFrame(() =>
        {
            gl.deleteProgram(this.imageProgramInfo.program);
            gl.deleteProgram(this.bufferAProgramInfo.program);
            gl.deleteProgram(this.selectMinProgramInfo.program);

            [this.bufferAInFbi, this.bufferAOutFbi]
            .forEach(function(fbi)
            {
                gl.deleteFramebuffer(fbi.framebuffer);
                for (const attachment of fbi.attachments) 
                {
                    if (attachment instanceof WebGLRenderbuffer) 
                    {
                        gl.deleteRenderbuffer(attachment);
                    } 
                    else
                    {
                        gl.deleteTexture(attachment);
                    }
                }
            });
        });
    }

    constructor(code)
    {
        

        const currentCommon = commonFs.replace(`{{implicitEquation}}`, code);

        GlslErrors.innerText = "";
        GlslErrors.style.visibility = "hidden";

        this.bufferAProgramInfo = twgl.createProgramInfo(gl, ["vs", concat(currentCommon, bufferAFs)], err => 
        { 
            const startSring = "// USER CODE START";
            const endString = "// USER CODE END";

            console.error(err);
            
            const startI = err.indexOf(startSring) + startSring.length;
            const endI = err.indexOf(endString);

            err = err.slice(startI, endI);

            // console.log(err);
            GlslErrors.innerText = err;
            GlslErrors.style.visibility = "visible";
        });
        if(this.bufferAProgramInfo == null) return;

        this.imageProgramInfo = twgl.createProgramInfo(gl, ["vs", concat(currentCommon, imageFs)]);
        this.selectMinProgramInfo = twgl.createProgramInfo(gl, ["vs", concat(currentCommon, selectMinFs)]);


        this.bufferAInFbi = twgl.createFramebufferInfo(gl, attachments);
        this.bufferAOutFbi = twgl.createFramebufferInfo(gl, attachments);



        gl.canvas.width = window.innerWidth - left.clientWidth; //gl.canvas.clientWidth;
        gl.canvas.height = window.innerHeight;

        // if (twgl.resizeCanvasToDisplaySize(gl.canvas))
        {
            // resize the attachments

            twgl.resizeFramebufferInfo(gl, this.bufferAInFbi, attachments);
            twgl.resizeFramebufferInfo(gl, this.bufferAOutFbi, attachments);
        }


        function draw(withProgramInfo, toFrameBufferInfo, fromFrameBufferInfo, uniforms)
        {
            twgl.bindFramebufferInfo(gl, toFrameBufferInfo);

            gl.useProgram(withProgramInfo.program);
            twgl.setBuffersAndAttributes(gl, withProgramInfo, vertexBufferInfo);
            twgl.setUniforms(withProgramInfo, Object.assign({}, uniforms, { bufferA: fromFrameBufferInfo.attachments[0] }));
            twgl.drawBufferInfo(gl, vertexBufferInfo);
        }


        this.halt = false;

        let frame = 0;
        let lastTime = 0;
        let fpsEMA = 0;  // exponential moving average
        const alpha = 0.2;
        let render = function (time)
        {
            time *= 0.001;

            fpsEMA = alpha / (time - lastTime) + (1 - alpha) * fpsEMA;

            if(frame % 5 == 0) updateFPS(fpsEMA);

            // if (twgl.resizeCanvasToDisplaySize(gl.canvas))
            {
                // resize the attachments

                // twgl.resizeFramebufferInfo(gl, bufferAInFbi, attachments);
                // twgl.resizeFramebufferInfo(gl, bufferAOutFbi, attachments);
            }

            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            const uniforms = Object.assign({
                time: time,
                resolution: [gl.canvas.width, gl.canvas.height],
                frame: frame,
                // bufferA: this.bufferAInFbi.attachments[0],
            }, getAxesUniforms(rotation, radius));

            
            for (let i = 0; i < 1; i++)
             {
                draw(this.bufferAProgramInfo, this.bufferAOutFbi, this.bufferAInFbi, uniforms);
                [this.bufferAInFbi, this.bufferAOutFbi] = [this.bufferAOutFbi, this.bufferAInFbi]; 

                draw(this.selectMinProgramInfo, this.bufferAOutFbi, this.bufferAInFbi, uniforms);
                [this.bufferAInFbi, this.bufferAOutFbi] = [this.bufferAOutFbi, this.bufferAInFbi];    
            }
            
            draw(this.imageProgramInfo, null, this.bufferAInFbi, uniforms);


            frame++;
            lastTime = time;
            
            if(!this.halt)
                requestAnimationFrame(render);
            // else 
            //     console.log("halted");
            
        }.bind(this);
        requestAnimationFrame(render);
    }
}

let currentPS = null;
function setImplicitEquation(code)
{
    if(currentPS) currentPS.deleteObj();
    currentPS = new ImplicitSurface(code);
}



/// Axes ///

// Rotation 

let rotation = [
    -0.7854428581286133,
    0.36959913571644576
];//[0, 0];
function getRotation(p)
{
    return [p[0] / gl.canvas.width, p[1] / gl.canvas.height].map(d => d*2*Math.PI);
}

let drag = false;
gl.canvas.addEventListener('mousedown', e => 
{
    drag = true;
});
gl.canvas.addEventListener('mousemove', e => {
    if(drag) rotation = getRotation([e.movementX, e.movementY]).map((d, i) => d + rotation[i]);
});
gl.canvas.addEventListener('mouseup', e => 
{
    drag = false;
});

gl.canvas.addEventListener('dblclick', e => 
{
    rotation = getRotation([e.offsetX - gl.canvas.width/2, e.offsetY - gl.canvas.height/2]);
});


// zoom

let radius = 3;  // 2;

gl.canvas.addEventListener("wheel", e => 
{

    radius *= Math.exp(e.deltaY / 1000);
});



function cross(a, b)
{
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]]
}
function dot(a, b) {
    return a.reduce((sum, v, i) => sum + v * b[i], 0);
}
function getAxesUniforms(rotation, radius)
{
    /*

    axes = mat3x3(Right,
                Up,
                Forward);
    
    Z
    ^
    |   ^ Y
    |  /
    | /
    |/_____> X

    X - Right
    Y - Forward
    Z - Up

    rotation = vec2({XY rotation}, {ZY rotation});

    */

    const XY = [-Math.sin(rotation[0]), -Math.cos(rotation[0])];
    const YZ = [-Math.sin(rotation[1]), Math.cos(rotation[1])];

    let right = [-XY[1], XY[0], 0];
    let up = [XY[0] * YZ[0], XY[1] * YZ[0], YZ[1]];
    const forward = cross(up, right);

    // const axes = right.concat(up).concat(forward);

    const projScale = 0.5 * Math.min(gl.canvas.width, gl.canvas.height) / radius;

    right = right.map(d => d / projScale);
    up = up.map(d => d / projScale);

    let projMat = right.concat(up).concat(forward);

    // projMat = projMat.map(d => d / projScale);

    return {projMat: projMat, radius: radius};
}


/// FPS ///

const fps = document.getElementById("fps");
function updateFPS(val)
{
    fps.textContent = val.toFixed(1);
}