precision highp float;

out vec4 fragColor;

const float initF = 0.1;

void main( void )
{
    vec2 fcoord = /*floor*/(gl_FragCoord.xy - vec2(resolution)/2.);
    ivec2 coord = ivec2(gl_FragCoord.xy);

    if(frame == 0)
    {
        fragColor = vec4(initF, 0, 0, UNSETTLED);
    }
    else
    {
        fragColor = texelFetch(bufferA, coord, 0);

        for(int x = max(0, coord.x - 1); x <= min(resolution.x - 1, coord.x + 1); x++)
        {
            for(int y = max(0, coord.y - 1); y <= min(resolution.y - 1, coord.y + 1); y++)
            {
                vec4 otherVal = texelFetch(bufferA, ivec2(x, y), 0);

                if(IS_SETTLED(otherVal) && (!IS_SETTLED(fragColor) || otherVal.x < fragColor.x))
                {
                    fragColor = otherVal + vec4(-0.05, 0, 0, 0);
                }
            }
        }

        if(!IS_SETTLED(fragColor))
        {
            fragColor.x = initF;
        }
    }
}